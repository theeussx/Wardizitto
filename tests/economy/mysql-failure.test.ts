import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEnvironment } from '../../src/core/config/environment.js';
import { DatabaseError, ValidationError } from '../../src/core/errors/app-error.js';
import { MySqlDatabase } from '../../src/infrastructure/database/mysql-database.js';
import { testLogger } from './database-fixture.js';

const driver = vi.hoisted(() => ({
  execute: vi.fn(),
  connection: {
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    destroy: vi.fn(),
    release: vi.fn(),
  },
}));
vi.mock('mysql2/promise', () => ({
  default: {
    createPool: () => ({
      execute: driver.execute,
      getConnection: () => Promise.resolve(driver.connection),
    }),
  },
}));

const config = parseEnvironment({
  NODE_ENV: 'test',
  DISCORD_TOKEN: 'unused-local-test-token',
  DISCORD_OWNER_IDS: '100000000000000001',
  DB_HOST: 'localhost',
  DB_USER: 'local',
  DB_PASSWORD: 'local',
  DB_NAME: 'local',
});

describe('MySqlDatabase em falhas de transporte', () => {
  const database = new MySqlDatabase(config, testLogger);
  beforeEach(() => vi.resetAllMocks());
  it('envia uma escrita apenas uma vez diante de resposta incerta', async () => {
    driver.execute.mockRejectedValue(
      Object.assign(new Error('lost response'), { code: 'ECONNRESET' }),
    );
    await expect(
      database.query('UPDATE economia_usuarios SET xp = xp + 1 WHERE user_id = ?', ['one']),
    ).rejects.toBeInstanceOf(DatabaseError);
    expect(driver.execute).toHaveBeenCalledTimes(1);
  });
  it.each(['beginTransaction', 'commit'] as const)(
    'descarta a conexão após falha em %s',
    async (phase) => {
      driver.connection[phase].mockRejectedValue(new Error(phase));
      await expect(database.transaction(() => Promise.resolve('ok'))).rejects.toBeInstanceOf(
        DatabaseError,
      );
      expect(driver.connection.destroy).toHaveBeenCalledOnce();
      expect(driver.connection.release).not.toHaveBeenCalled();
    },
  );
  it('preserva o erro de negócio somente após rollback confirmado', async () => {
    const error = new ValidationError('Saldo insuficiente.');
    await expect(database.transaction(() => Promise.reject(error))).rejects.toBe(error);
    expect(driver.connection.rollback).toHaveBeenCalledOnce();
    expect(driver.connection.release).toHaveBeenCalledOnce();
  });
  it('descarta a conexão quando rollback falha', async () => {
    driver.connection.rollback.mockRejectedValue(new Error('rollback'));
    await expect(
      database.transaction(() => Promise.reject(new Error('work'))),
    ).rejects.toBeInstanceOf(DatabaseError);
    expect(driver.connection.destroy).toHaveBeenCalledOnce();
    expect(driver.connection.release).not.toHaveBeenCalled();
  });
});
