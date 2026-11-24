import type { Guild, Role } from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';
import type { TransactionContext } from '../../application/ports/database.js';

import { query } from '../../infrastructure/database/legacy.js';
import { permitsSelfAssignment } from './role-policy.js';

interface VerificationPanel extends RowDataPacket {
  readonly role_id: string;
  readonly message_id: string;
}

export function resolveVerificationRole(
  panel: Pick<VerificationPanel, 'role_id' | 'message_id'> | undefined,
  messageId: string,
  customId: string,
  historicalRoleId: string | undefined,
): string | null | undefined {
  if (panel) return panel.message_id === messageId ? panel.role_id : null;
  return customId === 'verify:v1' ? null : historicalRoleId;
}

export async function readPanel(guildId: string): Promise<VerificationPanel | undefined> {
  const rows = await query<VerificationPanel[]>(
    'SELECT role_id, message_id FROM verification_panels WHERE guild_id = ?',
    [guildId],
  );
  return rows[0];
}

/** Match live overwrites against historical rows, including channels archived only in SQL. */
export async function hasTicketAccess(
  database: TransactionContext,
  guildId: string,
  channelIds: readonly string[],
): Promise<boolean> {
  const batchSize = 100;
  for (let offset = 0; offset < channelIds.length; offset += batchSize) {
    const ids = channelIds.slice(offset, offset + batchSize);
    const placeholders = ids.map(() => '?').join(', ');
    const [ticket] = await database.query<RowDataPacket[]>(
      `SELECT 1 FROM tickets WHERE guild_id = ? AND channel_id IN (${placeholders}) LIMIT 1`,
      [guildId, ...ids],
    );
    if (ticket) return true;
  }
  return false;
}

export async function eligibleRole(guild: Guild, roleId: string): Promise<Role | undefined> {
  if (roleId === guild.id) return undefined;
  const role = await guild.roles.fetch(roleId, { force: true });
  if (!role || role.managed || !role.editable || !permitsSelfAssignment(role.permissions.bitfield))
    return undefined;
  const [staffGrant] = await query<RowDataPacket[]>(
    `SELECT 1 FROM tickets_config WHERE guild_id = ? AND support_role_id = ?
     UNION ALL SELECT 1 FROM custom_permissions WHERE guild_id = ? AND subject_type = 'role' AND subject_id = ? AND allowed = TRUE LIMIT 1`,
    [guild.id, roleId, guild.id, roleId],
  );
  if (staffGrant) return undefined;
  const channels = await guild.channels.fetch();
  const grantedChannels: string[] = [];
  for (const [channelId, channel] of channels) {
    if (!channel) return undefined;
    const overwrite = channel.permissionOverwrites.cache.get(roleId);
    if (!overwrite) continue;
    if (!permitsSelfAssignment(overwrite.allow.bitfield)) return undefined;
    if (overwrite.allow.bitfield !== 0n) grantedChannels.push(channelId);
  }
  if (await hasTicketAccess({ query }, guild.id, grantedChannels)) return undefined;
  return role;
}
