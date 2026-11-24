import type { RowDataPacket } from 'mysql2/promise';
import { expect, it } from 'vitest';
import { MigrationRunner } from '../../src/infrastructure/database/migration-runner.js';
import { claimTicket } from '../../src/modules/tickets/application/claim-ticket.js';
import { hasTicketAccess } from '../../src/modules/verification/verification-settings.js';
import { integrationEnabled, openTestDatabase, testLogger } from '../economy/database-fixture.js';

it.runIf(integrationEnabled)(
  'isolates guilds and assigns each open ticket to exactly one concurrent claimant',
  async () => {
    const fixture = await openTestDatabase();
    try {
      const db = fixture.database;
      await new MigrationRunner(db, testLogger).migrate();
      await db.query(
        "INSERT INTO tickets (guild_id, channel_id, user_id, status) VALUES ('guild','channel','member','open'), ('guild','closed','member','closed')",
      );
      await expect(claimTicket(db, 'other', 'channel', 'staff')).resolves.toBe(false);
      await expect(claimTicket(db, 'guild', 'closed', 'staff')).resolves.toBe(false);
      const staff = Array.from({ length: 16 }, (_, index) => String(index));
      const attempts = await Promise.all(
        staff.map((id) => claimTicket(db, 'guild', 'channel', id)),
      );
      expect(attempts.filter(Boolean)).toHaveLength(1);
      expect(
        await db.query<RowDataPacket[]>(
          "SELECT claimed_by FROM tickets WHERE channel_id='channel'",
        ),
      ).toEqual([{ claimed_by: staff[attempts.indexOf(true)] }]);
    } finally {
      await fixture.close();
    }
  },
  60000,
);

it.runIf(integrationEnabled)(
  'blocks grants from old support-role overwrites on live ticket channels, even after a database-only closure',
  async () => {
    const fixture = await openTestDatabase();
    try {
      const db = fixture.database;
      await new MigrationRunner(db, testLogger).migrate();
      await db.query(
        "INSERT INTO tickets_config (guild_id, support_role_id) VALUES ('guild', 'new-support')",
      );
      await db.query(
        "INSERT INTO tickets (guild_id, channel_id, user_id, status) VALUES ('guild','old-open','one','open'), ('guild','old-archived','two','closed')",
      );
      const publicChannels = Array.from({ length: 120 }, (_, i) => 'public-' + String(i));
      await expect(hasTicketAccess(db, 'guild', [])).resolves.toBe(false);
      await expect(hasTicketAccess(db, 'guild', publicChannels)).resolves.toBe(false);
      await expect(hasTicketAccess(db, 'guild', [...publicChannels, 'old-open'])).resolves.toBe(
        true,
      );
      await expect(hasTicketAccess(db, 'guild', ['old-archived'])).resolves.toBe(true);
      await expect(hasTicketAccess(db, 'other', ['old-open'])).resolves.toBe(false);
    } finally {
      await fixture.close();
    }
  },
  60000,
);
