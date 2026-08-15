import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import type { Database } from '../../../application/ports/database.js';
import { ValidationError } from '../../../core/errors/app-error.js';
import type { Marriage } from '../domain/marriage.js';

interface MarriageRow extends RowDataPacket {
  readonly id: number;
  readonly guild_id: string;
  readonly user_id: string;
  readonly parceiro_id: string;
  readonly data: string | number;
}

const mapMarriage = (row: MarriageRow, perspectiveUserId: string): Marriage => ({
  id: row.id,
  guildId: row.guild_id,
  userId: perspectiveUserId,
  partnerId: row.user_id === perspectiveUserId ? row.parceiro_id : row.user_id,
  createdAt: Number(row.data),
});

export class MarriageService {
  public constructor(private readonly database: Database) {}

  public async find(guildId: string, userId: string): Promise<Marriage | undefined> {
    const rows = await this.database.query<MarriageRow[]>(
      `SELECT c.id, c.guild_id, c.user_id, c.parceiro_id, c.data
         FROM marriage_members m
         JOIN casamentos c ON c.id = m.marriage_id
        WHERE m.guild_id = ? AND m.user_id = ? LIMIT 1`,
      [guildId, userId],
    );
    return rows[0] === undefined ? undefined : mapMarriage(rows[0], userId);
  }

  public async marry(
    guildId: string,
    firstUserId: string,
    secondUserId: string,
    now = Date.now(),
  ): Promise<Marriage> {
    if (firstUserId === secondUserId)
      throw new ValidationError('Não é possível casar consigo mesmo.');
    try {
      return await this.database.transaction(async (transaction) => {
        const marriage = await transaction.query<ResultSetHeader>(
          'INSERT INTO casamentos (guild_id, user_id, parceiro_id, data) VALUES (?, ?, ?, ?)',
          [guildId, firstUserId, secondUserId, now],
        );
        await transaction.query<ResultSetHeader>(
          `INSERT INTO marriage_members (guild_id, user_id, marriage_id, partner_id)
           VALUES (?, ?, ?, ?), (?, ?, ?, ?)`,
          [
            guildId,
            firstUserId,
            marriage.insertId,
            secondUserId,
            guildId,
            secondUserId,
            marriage.insertId,
            firstUserId,
          ],
        );
        return {
          id: marriage.insertId,
          guildId,
          userId: firstUserId,
          partnerId: secondUserId,
          createdAt: now,
        };
      });
    } catch (error) {
      throw new ValidationError('Uma das pessoas já está casada neste servidor.', { cause: error });
    }
  }

  public async divorce(guildId: string, userId: string): Promise<Marriage | undefined> {
    return this.database.transaction(async (transaction) => {
      const members = await transaction.query<
        (RowDataPacket & { marriage_id: number; partner_id: string })[]
      >(
        `SELECT marriage_id, partner_id FROM marriage_members
          WHERE guild_id = ? AND user_id = ? FOR UPDATE`,
        [guildId, userId],
      );
      const member = members[0];
      if (member === undefined) return undefined;
      const rows = await transaction.query<MarriageRow[]>(
        `SELECT id, guild_id, user_id, parceiro_id, data FROM casamentos
          WHERE id = ? FOR UPDATE`,
        [member.marriage_id],
      );
      await transaction.query<ResultSetHeader>(
        'DELETE FROM marriage_members WHERE marriage_id = ?',
        [member.marriage_id],
      );
      await transaction.query<ResultSetHeader>(
        'DELETE FROM casamentos WHERE id = ? AND guild_id = ?',
        [member.marriage_id, guildId],
      );
      return rows[0] === undefined ? undefined : mapMarriage(rows[0], userId);
    });
  }
}
