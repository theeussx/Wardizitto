import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withTicketLock } from '../../src/modules/tickets/application/ticket-lock.js';
import { permitsSelfAssignment } from '../../src/modules/verification/role-policy.js';
import { PermissionFlagsBits as P } from 'discord.js';

const session = {
  acquire: vi.fn().mockResolvedValue(true),
  unlock: vi.fn().mockResolvedValue(true),
  release: vi.fn(),
  destroy: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  session.acquire.mockResolvedValue(true);
  session.unlock.mockResolvedValue(true);
});

describe('ticket advisory lock', () => {
  it('releases after a failed Discord action', async () => {
    await expect(
      withTicketLock(session, () => Promise.reject(new Error('Discord'))),
    ).rejects.toThrow('Discord');
    expect(session.unlock).toHaveBeenCalledOnce();
    expect(session.release).toHaveBeenCalledOnce();
  });
  it('discards an uncertain lock owner', async () => {
    session.unlock.mockRejectedValue(new Error('disconnect'));
    await expect(withTicketLock(session, () => Promise.resolve('ticket'))).rejects.toThrow();
    expect(session.destroy).toHaveBeenCalledOnce();
    expect(session.release).not.toHaveBeenCalled();
  });
  it('skips work if another opener owns the lock', async () => {
    session.acquire.mockResolvedValue(false);
    const work = vi.fn();
    await expect(withTicketLock(session, work)).resolves.toBeUndefined();
    expect(work).not.toHaveBeenCalled();
    expect(session.release).toHaveBeenCalledOnce();
  });
});

it('only grants reviewed participant permissions', () => {
  expect(permitsSelfAssignment(P.ViewChannel | P.SendMessages)).toBe(true);
  for (const permission of [
    P.Administrator,
    P.ManageRoles,
    P.ManageMessages,
    P.ManageWebhooks,
    P.KickMembers,
    1n << 62n,
  ]) {
    expect(permitsSelfAssignment(P.ViewChannel | permission)).toBe(false);
  }
});
