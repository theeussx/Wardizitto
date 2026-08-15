import { describe, expect, it } from 'vitest';

import {
  AppError,
  ConfigurationError,
  ExternalServiceError,
  DatabaseError,
  PermissionError,
  RateLimitError,
  ValidationError,
} from '../../src/core/errors/app-error.js';
import { Translator } from '../../src/core/localization/translator.js';

describe('Translator', () => {
  it('traduz e interpola variáveis', () => {
    const translator = new Translator('pt-BR');
    expect(translator.translate('error.rateLimit', 'pt-BR', { seconds: 3 })).toContain('3s');
    expect(translator.translate('error.guildOnly', 'en-US')).toContain('server');
  });
});

describe('erros da aplicação', () => {
  it('preserva metadados e causa sem expor erros internos', () => {
    const cause = new Error('root');
    const error = new AppError('failure', { cause, details: { operation: 'test' } });
    expect(error.cause).toBe(cause);
    expect(error.expose).toBe(false);
    expect(error.details).toEqual({ operation: 'test' });
  });

  it('configura códigos para erros operacionais', () => {
    expect(new ConfigurationError('bad').code).toBe('CONFIGURATION_ERROR');
    expect(new ValidationError('bad').expose).toBe(true);
    expect(new PermissionError().code).toBe('PERMISSION_DENIED');
    expect(new RateLimitError(500).retryAfterMs).toBe(500);
    expect(new ExternalServiceError('github', 'offline').details.service).toBe('github');
    expect(new DatabaseError('database').code).toBe('DATABASE_ERROR');
  });
});
