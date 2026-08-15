import { describe, expect, it } from 'vitest';

import { parseEnvironment } from '../../src/core/config/environment.js';
import { ConfigurationError } from '../../src/core/errors/app-error.js';

const validEnvironment = {
  NODE_ENV: 'test',
  DISCORD_TOKEN: 'a'.repeat(30),
  DISCORD_OWNER_IDS: '1033922089436053535, 1033922089436053535',
  DB_HOST: 'database',
  DB_USER: 'wardizitto',
  DB_PASSWORD: 'secret',
  DB_NAME: 'wardizitto_test',
} as const;

describe('parseEnvironment', () => {
  it('aplica defaults, converte tipos e remove IDs repetidos', () => {
    const config = parseEnvironment({
      ...validEnvironment,
      DB_PORT: '3307',
      DB_SSL: 'yes',
      DISCORD_REGISTER_COMMANDS: '0',
      WEBHOOK_LOGS_URL: '',
      PIX_KEY: '',
    });

    expect(config.DB_PORT).toBe(3307);
    expect(config.DB_SSL).toBe(true);
    expect(config.DISCORD_REGISTER_COMMANDS).toBe(false);
    expect(config.DISCORD_OWNER_IDS).toEqual(['1033922089436053535']);
    expect(config.DISCORD_PREFIX).toBe('!');
  });

  it('rejeita campos obrigatórios e IDs inválidos com erro operacional', () => {
    expect(() => parseEnvironment({ ...validEnvironment, DB_NAME: 'bad-name' })).toThrow(
      ConfigurationError,
    );
    expect(() => parseEnvironment({ ...validEnvironment, DISCORD_OWNER_IDS: 'not-an-id' })).toThrow(
      'IDs do Discord inválidos',
    );
  });

  it('exige guild em ambiente não global fora de testes', () => {
    expect(() => parseEnvironment({ ...validEnvironment, NODE_ENV: 'production' })).toThrow(
      ConfigurationError,
    );
  });
});
