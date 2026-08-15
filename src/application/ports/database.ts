import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export type QueryResult = RowDataPacket[] | RowDataPacket[][] | ResultSetHeader;
export type DatabaseValue = string | number | bigint | boolean | Date | null | Buffer | Uint8Array;

export interface TransactionContext {
  query<T extends QueryResult>(sql: string, parameters?: readonly DatabaseValue[]): Promise<T>;
}

export interface Database {
  connect(): Promise<void>;
  close(): Promise<void>;
  query<T extends QueryResult>(sql: string, parameters?: readonly DatabaseValue[]): Promise<T>;
  rawQuery<T extends QueryResult>(
    sql: string,
    parameters?: readonly DatabaseValue[],
  ): Promise<readonly [T, unknown]>;
  transaction<T>(work: (context: TransactionContext) => Promise<T>): Promise<T>;
  getConnection(): Promise<PoolConnection>;
}
