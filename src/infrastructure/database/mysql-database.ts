import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';

import type {
  Database,
  DatabaseValue,
  QueryResult,
  TransactionContext,
} from '../../application/ports/database.js';
import type { AppLogger } from '../../application/ports/logger.js';
import type { AppConfig } from '../../core/config/environment.js';
import { DatabaseError } from '../../core/errors/app-error.js';

const transientCodes = new Set([
  'PROTOCOL_CONNECTION_LOST',
  'ECONNRESET',
  'ETIMEDOUT',
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
]);

const errorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
};

const wait = async (durationMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

export class MySqlDatabase implements Database {
  private readonly pool: Pool;

  public constructor(
    config: AppConfig,
    private readonly logger: AppLogger,
  ) {
    this.pool = mysql.createPool({
      host: config.DB_HOST,
      port: config.DB_PORT,
      user: config.DB_USER,
      password: config.DB_PASSWORD,
      database: config.DB_NAME,
      connectionLimit: config.DB_CONNECTION_LIMIT,
      waitForConnections: true,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      charset: 'utf8mb4',
      timezone: 'Z',
      supportBigNumbers: true,
      bigNumberStrings: true,
      decimalNumbers: false,
      ...(config.DB_SSL ? { ssl: { rejectUnauthorized: true } } : {}),
    });
  }

  public async connect(): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.ping();
      this.logger.info('Conexão com MySQL validada.', {}, 'database');
    } finally {
      connection.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
    this.logger.info('Pool MySQL encerrado.', {}, 'database');
  }

  public async query<T extends QueryResult>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<T> {
    const [result] = await this.executeWithRetry<T>(sql, parameters);
    return result;
  }

  public async rawQuery<T extends QueryResult>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<readonly [T, unknown]> {
    return this.executeWithRetry<T>(sql, parameters);
  }

  public async transaction<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    try {
      const context: TransactionContext = {
        query: async <R extends QueryResult>(
          sql: string,
          parameters: readonly DatabaseValue[] = [],
        ) => {
          const [result] = await connection.execute(sql, [...parameters]);
          return result as R;
        },
      };
      const result = await work(context);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw new DatabaseError('A transação foi revertida.', { cause: error, retryable: false });
    } finally {
      connection.release();
    }
  }

  public getConnection(): Promise<PoolConnection> {
    return this.pool.getConnection();
  }

  private async executeWithRetry<T extends QueryResult>(
    sql: string,
    parameters: readonly DatabaseValue[],
  ): Promise<readonly [T, unknown]> {
    const startedAt = performance.now();
    let attempt = 0;
    while (attempt < 3) {
      attempt += 1;
      try {
        const [result, fields] = await this.pool.execute(sql, [...parameters]);
        const durationMs = performance.now() - startedAt;
        this.logger.debug(
          'Consulta executada.',
          { durationMs, attempt, operation: sql.trimStart().split(/\s+/, 1)[0] },
          'database',
        );
        if (durationMs >= 500) {
          this.logger.performance('Consulta lenta.', durationMs, {
            operation: sql.trimStart().split(/\s+/, 1)[0],
          });
        }
        return [result as T, fields];
      } catch (error) {
        const code = errorCode(error);
        const retryable = code !== undefined && transientCodes.has(code);
        if (!retryable || attempt >= 3) {
          this.logger.error(
            'Falha ao executar consulta.',
            error,
            { attempt, code, operation: sql.trimStart().split(/\s+/, 1)[0] },
            'database',
          );
          throw new DatabaseError('Não foi possível executar a operação no banco de dados.', {
            cause: error,
            details: { code, attempt },
            retryable,
          });
        }
        const delayMs = 100 * 2 ** (attempt - 1) + Math.floor(Math.random() * 50);
        this.logger.warn('Falha transitória no banco; nova tentativa agendada.', {
          attempt,
          delayMs,
          code,
        });
        await wait(delayMs);
      }
    }
    throw new DatabaseError('As tentativas de consulta foram esgotadas.');
  }
}

export type { ResultSetHeader, RowDataPacket };
