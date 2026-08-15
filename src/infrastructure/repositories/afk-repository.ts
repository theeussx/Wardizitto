import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import type { Database } from '../../application/ports/database.js';
import { TtlCache } from '../cache/ttl-cache.js';

export interface AfkStatus {
  readonly userId: string;
  readonly message: string;
  readonly since: number;
}

interface AfkRow extends RowDataPacket {
  readonly user_id: string;
  readonly mensagem: string;
  readonly timestamp: string | number;
}

export class AfkRepository {
  private readonly cache = new TtlCache<string, AfkStatus | null>({ maxEntries: 100_000 });

  public constructor(private readonly database: Database) {}

  public async findMany(
    guildId: string,
    userIds: readonly string[],
  ): Promise<readonly AfkStatus[]> {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return [];
    const results: AfkStatus[] = [];
    const missing: string[] = [];
    for (const userId of uniqueIds) {
      const cached = this.cache.get(`${guildId}:${userId}`);
      if (cached === undefined) missing.push(userId);
      else if (cached !== null) results.push(cached);
    }
    if (missing.length === 0) return results;

    const placeholders = missing.map(() => '?').join(',');
    const rows = await this.database.query<AfkRow[]>(
      `SELECT user_id, mensagem, timestamp FROM afk_status
        WHERE guild_id = ? AND user_id IN (${placeholders})`,
      [guildId, ...missing],
    );
    const byUser = new Map(
      rows.map((row) => [
        row.user_id,
        { userId: row.user_id, message: row.mensagem, since: Number(row.timestamp) },
      ]),
    );
    for (const userId of missing) {
      const status = byUser.get(userId) ?? null;
      this.cache.set(`${guildId}:${userId}`, status, status === null ? 30_000 : 60_000);
      if (status !== null) results.push(status);
    }
    return results;
  }

  public async set(
    guildId: string,
    userId: string,
    message: string,
    since = Date.now(),
  ): Promise<void> {
    await this.database.query<ResultSetHeader>(
      `INSERT INTO afk_status (guild_id, user_id, mensagem, timestamp)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE mensagem = VALUES(mensagem), timestamp = VALUES(timestamp)`,
      [guildId, userId, message, since],
    );
    this.cache.set(`${guildId}:${userId}`, { userId, message, since }, 60_000);
  }

  public async remove(guildId: string, userId: string): Promise<boolean> {
    const result = await this.database.query<ResultSetHeader>(
      'DELETE FROM afk_status WHERE guild_id = ? AND user_id = ?',
      [guildId, userId],
    );
    this.cache.set(`${guildId}:${userId}`, null, 30_000);
    return result.affectedRows > 0;
  }
}
