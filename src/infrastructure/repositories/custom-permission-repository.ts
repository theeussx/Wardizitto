import type { RowDataPacket } from 'mysql2/promise';

import type { Database } from '../../application/ports/database.js';
import type { CustomPermissionResolver } from '../../application/ports/custom-permission-resolver.js';
import { TtlCache } from '../cache/ttl-cache.js';

interface PermissionRow extends RowDataPacket {
  readonly subject_type: 'user' | 'role';
  readonly subject_id: string;
}

export class CustomPermissionRepository implements CustomPermissionResolver {
  private readonly cache = new TtlCache<string, boolean>({ maxEntries: 50_000 });

  public constructor(private readonly database: Database) {}

  public async hasPermission(
    guildId: string,
    userId: string,
    roleIds: readonly string[],
    permission: string,
  ): Promise<boolean> {
    const key = `${guildId}:${userId}:${roleIds.slice().sort().join(',')}:${permission}`;
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;

    const subjects = [userId, ...roleIds];
    if (subjects.length === 0) return false;
    const placeholders = subjects.map(() => '?').join(',');
    const rows = await this.database.query<PermissionRow[]>(
      `SELECT subject_type, subject_id
         FROM custom_permissions
        WHERE guild_id = ? AND permission = ? AND allowed = TRUE
          AND subject_id IN (${placeholders})
        LIMIT 1`,
      [guildId, permission, ...subjects],
    );
    const allowed = rows.length > 0;
    this.cache.set(key, allowed, 60_000);
    return allowed;
  }

  public invalidate(): void {
    this.cache.clear();
  }
}
