import type { RowDataPacket } from 'mysql2/promise';
import { expect, it } from 'vitest';
import { GuildConfigurationService } from '../../src/modules/configuration/application/guild-configuration.js';
import { MigrationRunner } from '../../src/infrastructure/database/migration-runner.js';
import { integrationEnabled, openTestDatabase, testLogger } from '../economy/database-fixture.js';

it.skipIf(!integrationEnabled)(
  'persiste a preferência, isola servidores e serializa atualizações concorrentes',
  async () => {
    const fixture = await openTestDatabase();
    try {
      await new MigrationRunner(fixture.database, testLogger).migrate();
      const settings = new GuildConfigurationService(fixture.database, 'pt-BR');
      const actor = {
        guildId: '200000000000000001',
        userId: '200000000000000002',
        canManageGuild: true,
      };
      const otherGuild = { ...actor, guildId: '200000000000000003' };
      expect(await settings.read(actor)).toEqual({ locale: 'pt-BR', revision: 0 });
      const updates = await Promise.all(
        Array.from({ length: 8 }, () => settings.setLocale(actor, 'en-US', 0)),
      );
      expect(updates.filter(Boolean)).toEqual([{ locale: 'en-US', revision: 1 }]);
      expect(await settings.read(otherGuild)).toEqual({ locale: 'pt-BR', revision: 0 });
      const secondClient = new GuildConfigurationService(fixture.database, 'pt-BR');
      expect(await secondClient.read(actor)).toEqual({ locale: 'en-US', revision: 1 });
      await secondClient.setLocale(actor, 'en-US', 1);
      const history = await fixture.database.query<RowDataPacket[]>(
        'SELECT guild_id, actor_id, previous_locale, locale, revision FROM guild_locale_changes WHERE guild_id = ?',
        [actor.guildId],
      );
      expect(history).toEqual([
        {
          guild_id: actor.guildId,
          actor_id: actor.userId,
          previous_locale: 'pt-BR',
          locale: 'en-US',
          revision: 1,
        },
      ]);
    } finally {
      await fixture.close();
    }
  },
  60_000,
);
