import type { ResultSetHeader } from 'mysql2/promise';
import type { TransactionContext } from '../../../application/ports/database.js';

export async function claimTicket(
  database: TransactionContext,
  guildId: string,
  channelId: string,
  staffId: string,
): Promise<boolean> {
  const result = await database.query<ResultSetHeader>(
    `UPDATE tickets SET claimed_by = ?
     WHERE guild_id = ? AND channel_id = ? AND status = 'open' AND claimed_by IS NULL`,
    [staffId, guildId, channelId],
  );
  return result.affectedRows === 1;
}
