import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import type { Database, TransactionContext } from '../../../application/ports/database.js';
import { ValidationError } from '../../../core/errors/app-error.js';
import type { BalanceChange, CooldownResult, EconomyAccount } from '../domain/economy-account.js';

interface AccountRow extends RowDataPacket {
  readonly user_id: string;
  readonly carteira: string | number;
  readonly banco: string | number;
  readonly xp: number;
  readonly level: number;
  readonly ultima_daily: Date | string | null;
  readonly ultima_trabalhar: Date | string | null;
  readonly sobre_mim: string;
}

const toAccount = (row: AccountRow): EconomyAccount => ({
  userId: row.user_id,
  wallet: BigInt(row.carteira),
  bank: BigInt(row.banco),
  xp: row.xp,
  level: row.level,
  lastDaily: row.ultima_daily === null ? null : new Date(row.ultima_daily),
  lastWork: row.ultima_trabalhar === null ? null : new Date(row.ultima_trabalhar),
  about: row.sobre_mim,
});

const requirePositive = (amount: bigint): void => {
  if (amount <= 0n) throw new ValidationError('O valor deve ser maior que zero.');
};

const accountFromRows = (rows: readonly AccountRow[]): EconomyAccount => {
  const row = rows[0];
  if (row === undefined) throw new Error('Conta de economia não encontrada.');
  return toAccount(row);
};

const ensureAccount = async (transaction: TransactionContext, userId: string): Promise<void> => {
  await transaction.query<ResultSetHeader>(
    `INSERT INTO economia_usuarios (user_id) VALUES (?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
    [userId],
  );
};

export class EconomyService {
  public constructor(private readonly database: Database) {}

  public async getAccount(userId: string): Promise<EconomyAccount> {
    await this.database.query<ResultSetHeader>(
      `INSERT INTO economia_usuarios (user_id) VALUES (?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)`,
      [userId],
    );
    const rows = await this.database.query<AccountRow[]>(
      `SELECT user_id, carteira, banco, xp, level, ultima_daily, ultima_trabalhar, sobre_mim
         FROM economia_usuarios WHERE user_id = ?`,
      [userId],
    );
    const row = rows[0];
    if (row === undefined) throw new Error('Conta de economia não pôde ser criada.');
    return toAccount(row);
  }

  public claimDaily(
    userId: string,
    reward: bigint,
    cooldownMs: number,
    now = new Date(),
  ): Promise<CooldownResult<BalanceChange>> {
    requirePositive(reward);
    return this.database.transaction(async (transaction) => {
      await ensureAccount(transaction, userId);
      const rows = await transaction.query<AccountRow[]>(
        `SELECT user_id, carteira, banco, xp, level, ultima_daily, ultima_trabalhar, sobre_mim
           FROM economia_usuarios WHERE user_id = ? FOR UPDATE`,
        [userId],
      );
      const account = accountFromRows(rows);
      const elapsed =
        account.lastDaily === null ? cooldownMs : now.getTime() - account.lastDaily.getTime();
      if (elapsed < cooldownMs) {
        return { available: false, retryAfterMs: cooldownMs - elapsed };
      }
      await transaction.query<ResultSetHeader>(
        'UPDATE economia_usuarios SET carteira = carteira + ?, ultima_daily = ? WHERE user_id = ?',
        [reward.toString(), now, userId],
      );
      return {
        available: true,
        retryAfterMs: 0,
        value: { wallet: account.wallet + reward, bank: account.bank },
      };
    });
  }

  public claimWork(
    userId: string,
    reward: bigint,
    xpGain: number,
    cooldownMs: number,
    now = new Date(),
  ): Promise<CooldownResult<{ readonly balance: BalanceChange; readonly xpGain: number }>> {
    requirePositive(reward);
    return this.database.transaction(async (transaction) => {
      await ensureAccount(transaction, userId);
      const rows = await transaction.query<AccountRow[]>(
        `SELECT user_id, carteira, banco, xp, level, ultima_daily, ultima_trabalhar, sobre_mim
           FROM economia_usuarios WHERE user_id = ? FOR UPDATE`,
        [userId],
      );
      const account = accountFromRows(rows);
      const elapsed =
        account.lastWork === null ? cooldownMs : now.getTime() - account.lastWork.getTime();
      if (elapsed < cooldownMs) {
        return { available: false, retryAfterMs: cooldownMs - elapsed };
      }
      await transaction.query<ResultSetHeader>(
        `UPDATE economia_usuarios
            SET carteira = carteira + ?, xp = xp + ?, ultima_trabalhar = ?
          WHERE user_id = ?`,
        [reward.toString(), Math.max(0, xpGain), now, userId],
      );
      return {
        available: true,
        retryAfterMs: 0,
        value: {
          balance: { wallet: account.wallet + reward, bank: account.bank },
          xpGain: Math.max(0, xpGain),
        },
      };
    });
  }

  public transfer(
    senderId: string,
    receiverId: string,
    amount: bigint,
    guildId: string | null,
    idempotencyKey: string,
  ): Promise<BalanceChange> {
    requirePositive(amount);
    if (senderId === receiverId)
      throw new ValidationError('Não é possível transferir para si mesmo.');
    return this.database.transaction(async (transaction) => {
      await ensureAccount(transaction, senderId);
      await ensureAccount(transaction, receiverId);
      const orderedIds = [senderId, receiverId].sort();
      const rows = await transaction.query<AccountRow[]>(
        `SELECT user_id, carteira, banco, xp, level, ultima_daily, ultima_trabalhar, sobre_mim
           FROM economia_usuarios WHERE user_id IN (?, ?) ORDER BY user_id FOR UPDATE`,
        orderedIds,
      );
      const accounts = new Map(rows.map((row) => [row.user_id, toAccount(row)]));
      const sender = accounts.get(senderId);
      const receiver = accounts.get(receiverId);
      if (sender === undefined || receiver === undefined) throw new Error('Conta não encontrada.');
      if (sender.wallet < amount) throw new ValidationError('Saldo insuficiente na carteira.');

      await transaction.query<ResultSetHeader>(
        'UPDATE economia_usuarios SET carteira = carteira - ? WHERE user_id = ?',
        [amount.toString(), senderId],
      );
      await transaction.query<ResultSetHeader>(
        'UPDATE economia_usuarios SET carteira = carteira + ? WHERE user_id = ?',
        [amount.toString(), receiverId],
      );
      await transaction.query<ResultSetHeader>(
        `INSERT INTO economy_transactions
           (user_id, counterparty_id, guild_id, kind, amount, balance_after, idempotency_key)
         VALUES (?, ?, ?, 'transfer_out', ?, ?, ?), (?, ?, ?, 'transfer_in', ?, ?, ?)`,
        [
          senderId,
          receiverId,
          guildId,
          (-amount).toString(),
          (sender.wallet - amount).toString(),
          `${idempotencyKey}:out`,
          receiverId,
          senderId,
          guildId,
          amount.toString(),
          (receiver.wallet + amount).toString(),
          `${idempotencyKey}:in`,
        ],
      );
      return { wallet: sender.wallet - amount, bank: sender.bank };
    });
  }

  public moveFunds(
    userId: string,
    amount: bigint,
    direction: 'deposit' | 'withdraw',
  ): Promise<BalanceChange> {
    requirePositive(amount);
    return this.database.transaction(async (transaction) => {
      await ensureAccount(transaction, userId);
      const rows = await transaction.query<AccountRow[]>(
        `SELECT user_id, carteira, banco, xp, level, ultima_daily, ultima_trabalhar, sobre_mim
           FROM economia_usuarios WHERE user_id = ? FOR UPDATE`,
        [userId],
      );
      const account = accountFromRows(rows);
      if (direction === 'deposit' && account.wallet < amount) {
        throw new ValidationError('Saldo insuficiente na carteira.');
      }
      if (direction === 'withdraw' && account.bank < amount) {
        throw new ValidationError('Saldo insuficiente no banco.');
      }
      const wallet = direction === 'deposit' ? account.wallet - amount : account.wallet + amount;
      const bank = direction === 'deposit' ? account.bank + amount : account.bank - amount;
      await transaction.query<ResultSetHeader>(
        'UPDATE economia_usuarios SET carteira = ?, banco = ? WHERE user_id = ?',
        [wallet.toString(), bank.toString(), userId],
      );
      return { wallet, bank };
    });
  }

  public changeBalance(
    userId: string,
    delta: bigint,
    destination: 'wallet' | 'bank',
  ): Promise<BalanceChange> {
    if (delta === 0n) throw new ValidationError('O valor não pode ser zero.');
    return this.database.transaction(async (transaction) => {
      await ensureAccount(transaction, userId);
      const rows = await transaction.query<AccountRow[]>(
        `SELECT user_id, carteira, banco, xp, level, ultima_daily, ultima_trabalhar, sobre_mim
           FROM economia_usuarios WHERE user_id = ? FOR UPDATE`,
        [userId],
      );
      const account = accountFromRows(rows);
      const wallet = destination === 'wallet' ? account.wallet + delta : account.wallet;
      const bank = destination === 'bank' ? account.bank + delta : account.bank;
      if (wallet < 0n || bank < 0n)
        throw new ValidationError('A operação deixaria o saldo negativo.');
      await transaction.query<ResultSetHeader>(
        'UPDATE economia_usuarios SET carteira = ?, banco = ? WHERE user_id = ?',
        [wallet.toString(), bank.toString(), userId],
      );
      return { wallet, bank };
    });
  }

  public purchaseItem(
    userId: string,
    guildId: string,
    itemId: number,
  ): Promise<{ readonly itemName: string; readonly balance: BalanceChange }> {
    if (!Number.isSafeInteger(itemId) || itemId <= 0) throw new ValidationError('Item inválido.');
    return this.database.transaction(async (transaction) => {
      await ensureAccount(transaction, userId);
      const items = await transaction.query<
        (RowDataPacket & { item_nome: string; preco: string | number })[]
      >(
        `SELECT item_nome, preco FROM economia_loja
          WHERE id = ? AND disponivel_web = TRUE FOR UPDATE`,
        [itemId],
      );
      const item = items[0];
      if (item === undefined) throw new ValidationError('Este item não está disponível.');
      const price = BigInt(item.preco);
      const rows = await transaction.query<AccountRow[]>(
        `SELECT user_id, carteira, banco, xp, level, ultima_daily, ultima_trabalhar, sobre_mim
           FROM economia_usuarios WHERE user_id = ? FOR UPDATE`,
        [userId],
      );
      const account = accountFromRows(rows);
      if (account.wallet < price) throw new ValidationError('Saldo insuficiente na carteira.');
      const wallet = account.wallet - price;
      await transaction.query<ResultSetHeader>(
        'UPDATE economia_usuarios SET carteira = ? WHERE user_id = ?',
        [wallet.toString(), userId],
      );
      await transaction.query<ResultSetHeader>(
        `INSERT INTO economia_inventario (user_id, guild_id, item_id, quantidade)
         VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE quantidade = quantidade + 1`,
        [userId, guildId, itemId],
      );
      return { itemName: item.item_nome, balance: { wallet, bank: account.bank } };
    });
  }

  public settleWager(
    userId: string,
    stake: bigint,
    won: boolean,
    xp: number,
  ): Promise<BalanceChange> {
    requirePositive(stake);
    return this.database.transaction(async (transaction) => {
      await ensureAccount(transaction, userId);
      const rows = await transaction.query<AccountRow[]>(
        `SELECT user_id, carteira, banco, xp, level, ultima_daily, ultima_trabalhar, sobre_mim
           FROM economia_usuarios WHERE user_id = ? FOR UPDATE`,
        [userId],
      );
      const account = accountFromRows(rows);
      if (account.wallet < stake) throw new ValidationError('Saldo insuficiente na carteira.');
      const wallet = won ? account.wallet + stake : account.wallet - stake;
      await transaction.query<ResultSetHeader>(
        'UPDATE economia_usuarios SET carteira = ?, xp = xp + ? WHERE user_id = ?',
        [wallet.toString(), won ? Math.max(0, xp) : 0, userId],
      );
      return { wallet, bank: account.bank };
    });
  }
}
