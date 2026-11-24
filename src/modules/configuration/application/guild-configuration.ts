import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Database } from '../../../application/ports/database.js';
import { PermissionError, ValidationError } from '../../../core/errors/app-error.js';
import type { Locale } from '../../../core/localization/translator.js';

export interface GuildActor {
  readonly guildId: string;
  readonly userId: string;
  readonly canManageGuild: boolean;
}

export interface GuildConfiguration {
  readonly locale: Locale;
  readonly revision: number;
}

interface ConfigurationRow extends RowDataPacket, GuildConfiguration {}

export const isLocale = (value: unknown): value is Locale => value === 'pt-BR' || value === 'en-US';

function authorize(actor: GuildActor): void {
  const id = /^\d{17,20}$/u;
  if (!actor.canManageGuild || !id.test(actor.userId) || !id.test(actor.guildId)) {
    throw new PermissionError();
  }
}

export class GuildConfigurationService {
  public constructor(
    private readonly database: Pick<Database, 'query' | 'transaction'>,
    private readonly defaultLocale: Locale,
  ) {}

  public async read(actor: GuildActor): Promise<GuildConfiguration> {
    authorize(actor);
    const [row] = await this.database.query<ConfigurationRow[]>(
      'SELECT locale, revision FROM guild_configuration WHERE guild_id = ?',
      [actor.guildId],
    );
    return row
      ? { locale: row.locale, revision: row.revision }
      : { locale: this.defaultLocale, revision: 0 };
  }

  public async setLocale(
    actor: GuildActor,
    locale: Locale,
    expectedRevision: number,
  ): Promise<GuildConfiguration | null> {
    authorize(actor);
    if (
      !isLocale(locale) ||
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      expectedRevision > 4294967295
    ) {
      throw new ValidationError('Preferência de idioma inválida.');
    }
    return this.database.transaction(async (tx) => {
      await tx.query<ResultSetHeader>(
        'INSERT INTO guild_configuration (guild_id, locale) VALUES (?, ?) ON DUPLICATE KEY UPDATE guild_id = guild_id',
        [actor.guildId, this.defaultLocale],
      );
      const [row] = await tx.query<ConfigurationRow[]>(
        'SELECT locale, revision FROM guild_configuration WHERE guild_id = ? FOR UPDATE',
        [actor.guildId],
      );
      if (row?.revision !== expectedRevision) return null;
      if (row.locale === locale) return { locale, revision: row.revision };
      const revision = row.revision + 1;
      await tx.query<ResultSetHeader>(
        'UPDATE guild_configuration SET locale = ?, revision = ? WHERE guild_id = ?',
        [locale, revision, actor.guildId],
      );
      await tx.query<ResultSetHeader>(
        'INSERT INTO guild_locale_changes (guild_id, revision, actor_id, previous_locale, locale) VALUES (?, ?, ?, ?, ?)',
        [actor.guildId, revision, actor.userId, row.locale, locale],
      );
      return { locale, revision };
    });
  }
}
