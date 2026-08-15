export interface EconomyAccount {
  readonly userId: string;
  readonly wallet: bigint;
  readonly bank: bigint;
  readonly xp: number;
  readonly level: number;
  readonly lastDaily: Date | null;
  readonly lastWork: Date | null;
  readonly about: string;
}

export interface CooldownResult<T> {
  readonly available: boolean;
  readonly retryAfterMs: number;
  readonly value?: T;
}

export interface BalanceChange {
  readonly wallet: bigint;
  readonly bank: bigint;
}
