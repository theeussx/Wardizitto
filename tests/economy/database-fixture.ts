import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import { vi } from 'vitest';

import type { AppLogger } from '../../src/application/ports/logger.js';
import { parseEnvironment } from '../../src/core/config/environment.js';
import { MySqlDatabase } from '../../src/infrastructure/database/mysql-database.js';

export const integrationEnabled = process.env.WARD_TEST_MYSQL_PORT !== undefined;
export const testLogger: AppLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  audit: vi.fn(),
  performance: vi.fn(),
  child: () => testLogger,
};

export interface TestDatabase {
  readonly database: MySqlDatabase;
  readonly close: () => Promise<void>;
}

export const openTestDatabase = async (): Promise<TestDatabase> => {
  if (!integrationEnabled)
    throw new Error('Set WARD_TEST_MYSQL_PORT to use the disposable database.');
  const name = 'ward_test_' + randomBytes(12).toString('hex');
  const config = parseEnvironment({
    NODE_ENV: 'test',
    DISCORD_OWNER_IDS: '100000000000000001',
    DISCORD_TOKEN: 'unused-local-test-token',
    DB_HOST: '127.0.0.1',
    DB_PORT: process.env.WARD_TEST_MYSQL_PORT,
    DB_USER: process.env.WARD_TEST_MYSQL_USER ?? 'root',
    DB_PASSWORD: process.env.WARD_TEST_MYSQL_PASSWORD,
    DB_NAME: name,
  });
  const admin = await mysql.createConnection({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
  });
  try {
    await admin.query('CREATE DATABASE ?? CHARACTER SET utf8mb4', [name]);
  } catch (error) {
    await admin.end();
    throw error;
  }
  const database = new MySqlDatabase(config, testLogger);
  return {
    database,
    close: async () => {
      try {
        await database.close();
        await admin.query('DROP DATABASE ??', [name]);
      } finally {
        await admin.end();
      }
    },
  };
};
