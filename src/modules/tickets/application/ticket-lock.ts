interface LockSession {
  acquire(): Promise<boolean>;
  unlock(): Promise<boolean>;
  release(): void;
  destroy(): void;
}

/** A pooled socket must never return to the pool with an advisory lock attached. */
export async function withTicketLock<T>(
  session: LockSession,
  work: () => Promise<T>,
): Promise<T | undefined> {
  let reusable = false;
  try {
    if (!(await session.acquire())) {
      reusable = true;
      return undefined;
    }
    try {
      return await work();
    } finally {
      reusable = await session.unlock();
    }
  } finally {
    if (reusable) session.release();
    else session.destroy();
  }
}
