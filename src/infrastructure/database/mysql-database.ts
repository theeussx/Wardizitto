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
import { AppError, DatabaseError } from '../../core/errors/app-error.js';

const errorCode = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
};

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
    const [result] = await this.execute<T>(sql, parameters);
    return result;
  }

  public async rawQuery<T extends QueryResult>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<readonly [T, unknown]> {
    return this.execute<T>(sql, parameters);
  }

  public async transaction<T>(work: (context: TransactionContext) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    let reusable = false;
    try {
      await connection.beginTransaction();
      const context: TransactionContext = {
        query: async <R extends QueryResult>(
          sql: string,
          parameters: readonly DatabaseValue[] = [],
        ) => {
          const [result] = await connection.execute<R>(sql, [...parameters]);
          return result;
        },
      };
      let result: T;
      try {
        result = await work(context);
      } catch (error) {
        await connection.rollback();
        reusable = true;
        throw error;
      }
      await connection.commit();
      reusable = true;
      return result;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new DatabaseError('Não foi possível concluir a transação.', { cause: error });
    } finally {
      if (reusable) connection.release();
      else connection.destroy();
    }
  }

  public getConnection(): Promise<PoolConnection> {
    return this.pool.getConnection();
  }

  private async execute<T extends QueryResult>(
    sql: string,
    parameters: readonly DatabaseValue[],
  ): Promise<readonly [T, unknown]> {
    const startedAt = performance.now();
    const operation = sql.trimStart().split(/\s+/, 1)[0];
    try {
      const result = await this.pool.execute<T>(sql, [...parameters]);
      const durationMs = performance.now() - startedAt;
      this.logger.debug('Consulta executada.', { durationMs, operation }, 'database');
      if (durationMs >= 500) this.logger.performance('Consulta lenta.', durationMs, { operation });
      return result;
    } catch (cause) {
      const code = errorCode(cause);
      this.logger.error('Falha ao executar consulta.', undefined, { code, operation }, 'database');
      throw new DatabaseError('Não foi possível executar a operação no banco de dados.', {
        cause,
        details: { code },
      });
    }
  }
}

export type { ResultSetHeader, RowDataPacket };
