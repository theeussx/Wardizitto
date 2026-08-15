import { describe, expect, it } from 'vitest';

import { TtlCache } from '../../src/infrastructure/cache/ttl-cache.js';

describe('TtlCache', () => {
  it('expira entradas de forma determinística', () => {
    let now = 1_000;
    const cache = new TtlCache<string, number>({ now: () => now });
    cache.set('answer', 42, 500);

    expect(cache.get('answer')).toBe(42);
    expect(cache.expiresIn('answer')).toBe(500);
    now = 1_500;
    expect(cache.get('answer')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('limita memória removendo a entrada mais antiga', () => {
    const cache = new TtlCache<string, number>({ maxEntries: 2, now: () => 0 });
    cache.set('first', 1, 10_000);
    cache.set('second', 2, 10_000);
    cache.set('third', 3, 10_000);

    expect(cache.has('first')).toBe(false);
    expect(cache.get('second')).toBe(2);
    expect(cache.delete('second')).toBe(true);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('ignora TTL não positivo e remove expirados em lote', () => {
    let now = 0;
    const cache = new TtlCache<string, boolean>({ now: () => now });
    cache.set('ignored', true, 0);
    cache.set('one', true, 10);
    cache.set('two', true, 20);
    now = 15;
    expect(cache.removeExpired()).toBe(1);
    expect(cache.has('two')).toBe(true);
  });
});
