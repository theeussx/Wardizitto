import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Locale } from '../core/localization/translator.js';

export const flowLifetime = 5 * 60;
export const sessionLifetime = 30 * 60;
const maxFlows = 1024;
const maxSessions = 4096;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/u;

export const randomToken = (): string => randomBytes(32).toString('base64url');

export function matchesToken(actual: string | null | undefined, expected: string): boolean {
  return Boolean(
    actual &&
    tokenPattern.test(actual) &&
    timingSafeEqual(Buffer.from(actual), Buffer.from(expected)),
  );
}

interface Flow {
  readonly state: string;
  readonly verifier: string;
  readonly expiresAt: number;
}

export interface Session {
  readonly userId: string;
  readonly accessToken: string;
  readonly locale: Locale;
  readonly csrf: string;
  readonly expiresAt: number;
}

export class DashboardSessions {
  private readonly flows = new Map<string, Flow>();
  private readonly sessions = new Map<string, Session>();
  private nextSweep = 0;

  public constructor(private readonly now: () => number) {}

  public begin(previousId: string | undefined): (Flow & { readonly id: string }) | undefined {
    const now = this.now();
    this.sweep(now);
    if (previousId) this.flows.delete(previousId);
    if (this.flows.size >= maxFlows) return;
    const id = randomToken();
    const flow = {
      state: randomToken(),
      verifier: randomToken(),
      expiresAt: now + flowLifetime * 1000,
    };
    this.flows.set(id, flow);
    return { id, ...flow };
  }

  public takeFlow(id: string | undefined, state: string): Flow | undefined {
    if (!id) return;
    const flow = this.flows.get(id);
    if (!flow) return;
    if (flow.expiresAt <= this.now()) {
      this.flows.delete(id);
      return;
    }
    if (!matchesToken(state, flow.state)) return;
    this.flows.delete(id);
    return flow;
  }

  public authenticate(
    identity: Pick<Session, 'userId' | 'accessToken' | 'locale'>,
    expiresIn: number,
    previousId: string | undefined,
  ): { readonly id: string; readonly maxAge: number } | undefined {
    const now = this.now();
    this.sweep(now);
    if (previousId) this.sessions.delete(previousId);
    if (this.sessions.size >= maxSessions) return;
    const maxAge = Math.min(expiresIn, sessionLifetime);
    const id = randomToken();
    this.sessions.set(id, {
      ...identity,
      csrf: randomToken(),
      expiresAt: now + maxAge * 1000,
    });
    return { id, maxAge };
  }

  public get(id: string | undefined): Session | undefined {
    if (!id) return;
    const session = this.sessions.get(id);
    if (session && session.expiresAt <= this.now()) {
      this.sessions.delete(id);
      return;
    }
    return session;
  }

  public delete(id: string | undefined): void {
    if (id) this.sessions.delete(id);
  }

  private sweep(now: number): void {
    if (this.nextSweep > now) return;
    this.nextSweep = now + 30_000;
    for (const [id, value] of this.flows) if (value.expiresAt <= now) this.flows.delete(id);
    for (const [id, value] of this.sessions) if (value.expiresAt <= now) this.sessions.delete(id);
  }
}
