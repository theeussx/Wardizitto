import { RateLimitError } from '../../core/errors/app-error.js';
import { TtlCache } from '../../infrastructure/cache/ttl-cache.js';

interface WindowState {
  readonly count: number;
}

export interface RateLimiterOptions {
  readonly windowMs: number;
  readonly maxRequests: number;
  readonly maxKeys?: number;
}

export class RateLimiter {
  private readonly windows: TtlCache<string, WindowState>;

  public constructor(private readonly options: RateLimiterOptions) {
    this.windows = new TtlCache({ maxEntries: options.maxKeys ?? 100_000 });
  }

  public consume(key: string): void {
    const current = this.windows.get(key);
    if (current !== undefined && current.count >= this.options.maxRequests) {
      throw new RateLimitError(this.windows.expiresIn(key));
    }

    const count = (current?.count ?? 0) + 1;
    const ttl = current === undefined ? this.options.windowMs : this.windows.expiresIn(key);
    this.windows.set(key, { count }, Math.max(ttl, 1));
  }
}

export class CooldownService {
  private readonly cooldowns = new TtlCache<string, true>({ maxEntries: 100_000 });

  public assertAvailable(key: string, durationMs: number): void {
    const remaining = this.cooldowns.expiresIn(key);
    if (remaining > 0) throw new RateLimitError(remaining);
    this.cooldowns.set(key, true, durationMs);
  }
}
