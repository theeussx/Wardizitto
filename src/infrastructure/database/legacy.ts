import type { Database, DatabaseValue, QueryResult } from '../../application/ports/database.js';
import { ConfigurationError } from '../../core/errors/app-error.js';

let database: Database | undefined;

const currentDatabase = (): Database => {
  if (database === undefined) {
    throw new ConfigurationError('O adaptador de banco legado ainda não foi inicializado.');
  }
  return database;
};

export const configureLegacyDatabase = (configuredDatabase: Database): void => {
  database = configuredDatabase;
};

export const query = async <T extends QueryResult>(
  sql: string,
  parameters: readonly DatabaseValue[] = [],
): Promise<T> => currentDatabase().query<T>(sql, parameters);

export const pool = {
  query: async <T extends QueryResult>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<readonly [T, unknown]> => currentDatabase().rawQuery<T>(sql, parameters),
  execute: async <T extends QueryResult>(
    sql: string,
    parameters: readonly DatabaseValue[] = [],
  ): Promise<readonly [T, unknown]> => currentDatabase().rawQuery<T>(sql, parameters),
  getConnection: () => currentDatabase().getConnection(),
};
