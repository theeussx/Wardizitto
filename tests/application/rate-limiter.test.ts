import { describe, expect, it } from 'vitest';

import { CooldownService, RateLimiter } from '../../src/application/services/rate-limiter.js';
import { RateLimitError } from '../../src/core/errors/app-error.js';

describe('RateLimiter', () => {
  it('bloqueia requisições acima da janela configurada', () => {
    const limiter = new RateLimiter({ windowMs: 10_000, maxRequests: 2 });
    limiter.consume('user');
    limiter.consume('user');
    expect(() => limiter.consume('user')).toThrow(RateLimitError);
    expect(() => limiter.consume('another-user')).not.toThrow();
  });
});

describe('CooldownService', () => {
  it('informa cooldown por chave sem afetar outras chaves', () => {
    const cooldowns = new CooldownService();
    cooldowns.assertAvailable('command:user', 10_000);
    expect(() => cooldowns.assertAvailable('command:user', 10_000)).toThrow(RateLimitError);
    expect(() => cooldowns.assertAvailable('other:user', 10_000)).not.toThrow();
  });
});
