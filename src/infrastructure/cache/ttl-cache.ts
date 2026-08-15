interface CacheEntry<T> {
  readonly value: T;
  readonly expiresAt: number;
}

export interface TtlCacheOptions {
  readonly maxEntries?: number;
  readonly now?: () => number;
}

export class TtlCache<K, V> {
  private readonly entries = new Map<K, CacheEntry<V>>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  public constructor(options: TtlCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 100_000;
    this.now = options.now ?? Date.now;
  }

  public get size(): number {
    return this.entries.size;
  }

  public set(key: K, value: V, ttlMs: number): void {
    if (ttlMs <= 0) return;
    this.removeExpired();
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
  }

  public get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (entry === undefined) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  public expiresIn(key: K): number {
    const entry = this.entries.get(key);
    if (entry === undefined) return 0;
    const remaining = entry.expiresAt - this.now();
    if (remaining <= 0) {
      this.entries.delete(key);
      return 0;
    }
    return remaining;
  }

  public has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  public delete(key: K): boolean {
    return this.entries.delete(key);
  }

  public clear(): void {
    this.entries.clear();
  }

  public removeExpired(): number {
    const current = this.now();
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= current) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}
