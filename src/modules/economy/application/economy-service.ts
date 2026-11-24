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

const maxBalance = (1n << 63n) - 1n;

const storedBalance = (value: bigint): string => {
  if (value < 0n || value > maxBalance)
    throw new ValidationError('Saldo fora dos limites permitidos.');
  return value.toString();
};

const recordChange = async (
  transaction: TransactionContext,
  userId: string,
  kind: string,
  delta: bigint,
  balance: BalanceChange,
  operationId?: string,
  guildId?: string,
  metadata: Readonly<Record<string, string>> = {},
): Promise<void> => {
  await transaction.query<ResultSetHeader>(
    `INSERT INTO economy_transactions
       (user_id, guild_id, kind, amount, balance_after, metadata, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      guildId ?? null,
      kind,
      delta.toString(),
      balance.wallet.toString(),
      JSON.stringify({ bank: balance.bank.toString(), ...metadata }),
      operationId ?? null,
    ],
  );
};

interface ReceiptRow extends RowDataPacket {
  readonly user_id: string;
  readonly kind: string;
  readonly guild_id: string | null;
  readonly amount: string;
  readonly balance_after: string;
  readonly bank: string | null;
  readonly requested: string | null;
  readonly item_name: string | null;
}

async function findReceipt(
  transaction: TransactionContext,
  operationId: string | undefined,
  expected: { userId: string; kind: string; guildId?: string; requested: string },
): Promise<{ balance: BalanceChange; itemName: string | null } | undefined> {
  if (operationId === undefined) return undefined;
  const [row] = await transaction.query<ReceiptRow[]>(
    `SELECT user_id, kind, guild_id, amount, balance_after,
       JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.bank')) AS bank,
       JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.requested')) AS requested,
       JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.item_name')) AS item_name
     FROM economy_transactions WHERE idempotency_key = ?`,
    [operationId],
  );
  if (!row) return undefined;
  if (
    row.user_id !== expected.userId ||
    row.kind !== expected.kind ||
    row.guild_id !== (expected.guildId ?? null) ||
    row.requested !== expected.requested ||
    row.bank === null
  ) {
    throw new ValidationError('O identificador já foi usado em outra operação.');
  }
  return {
    balance: { wallet: BigInt(row.balance_after), bank: BigInt(row.bank) },
    itemName: row.item_name,
  };
}

// Historical progression advances one level per rewarded action.
const applyExperience = (
  account: EconomyAccount,
  gain: number,
): { xp: number; level: number; bonus: bigint } => {
  if (!Number.isSafeInteger(gain) || gain < 0 || gain > 0xffffffff)
    throw new ValidationError('XP inválido.');
  const nextXp = account.xp + gain;
  const threshold = account.level * 500;
  if (gain > 0 && nextXp >= threshold) {
    if (nextXp - threshold > 0xffffffff) throw new ValidationError('XP excede o limite permitido.');
    return {
      xp: nextXp - threshold,
      level: account.level + 1,
      bonus: BigInt(account.level + 1) * 1000n,
    };
  }
  if (nextXp > 0xffffffff) throw new ValidationError('XP excede o limite permitido.');
  return { xp: nextXp, level: account.level, bonus: 0n };
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

  public async findProfile(
    userId: string,
  ): Promise<(EconomyAccount & { profession: string | null }) | undefined> {
    const [row] = await this.database.query<(AccountRow & { profissao: string | null })[]>(
      `SELECT u.user_id, u.carteira, u.banco, u.xp, u.level, u.ultima_daily, u.ultima_trabalhar,
          u.sobre_mim, p.profissao FROM economia_usuarios u
        LEFT JOIN economia_profissoes p ON p.user_id = u.user_id WHERE u.user_id = ?`,
      [userId],
    );
    return row && { ...toAccount(row), profession: row.profissao };
  }

  public async leaders(): Promise<{ userId: string; total: bigint }[]> {
    const rows = await this.database.query<(RowDataPacket & { user_id: string; total: string })[]>(
      `SELECT user_id, (CAST(carteira AS DECIMAL(20,0)) + banco) AS total
        FROM economia_usuarios ORDER BY total DESC, user_id LIMIT 10`,
    );
    return rows.map((row) => ({ userId: row.user_id, total: BigInt(row.total) }));
  }

  public async inventory(
    userId: string,
    guildId: string,
  ): Promise<{ name: string; quantity: number }[]> {
    const rows = await this.database.query<
      (RowDataPacket & { item_nome: string; quantidade: number })[]
    >(
      `SELECT l.item_nome, i.quantidade FROM economia_inventario i JOIN economia_loja l ON i.item_id = l.id
        WHERE i.user_id = ? AND i.guild_id = ? ORDER BY l.item_nome, l.id LIMIT 50`,
      [userId, guildId],
    );
    return rows.map((row) => ({ name: row.item_nome, quantity: row.quantidade }));
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
        'UPDATE economia_usuarios SET carteira = ?, ultima_daily = ? WHERE user_id = ?',
        [storedBalance(account.wallet + reward), now, userId],
      );
      await recordChange(transaction, userId, 'daily', reward, {
        wallet: account.wallet + reward,
        bank: account.bank,
      });
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
  ): Promise<
    CooldownResult<{
      readonly balance: BalanceChange;
      readonly xpGain: number;
      readonly level: number;
      readonly levelBonus: bigint;
    }>
  > {
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
      const { xp, level, bonus } = applyExperience(account, xpGain);
      const balance = { wallet: account.wallet + reward + bonus, bank: account.bank };
      await transaction.query<ResultSetHeader>(
        `UPDATE economia_usuarios SET carteira = ?, xp = ?, level = ?, ultima_trabalhar = ? WHERE user_id = ?`,
        [storedBalance(balance.wallet), xp, level, now, userId],
      );
      await recordChange(transaction, userId, 'work', reward, {
        wallet: account.wallet + reward,
        bank: account.bank,
      });
      if (bonus > 0n) await recordChange(transaction, userId, 'level_up', bonus, balance);
      return {
        available: true,
        retryAfterMs: 0,
        value: {
          balance,
          xpGain,
          level,
          levelBonus: bonus,
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
      const orderedIds = [senderId, receiverId].sort();
      for (const id of orderedIds) await ensureAccount(transaction, id);
      const rows = await transaction.query<AccountRow[]>(
        `SELECT user_id, carteira, banco, xp, level, ultima_daily, ultima_trabalhar, sobre_mim
           FROM economia_usuarios WHERE user_id IN (?, ?) ORDER BY user_id FOR UPDATE`,
        orderedIds,
      );
      const accounts = new Map(rows.map((row) => [row.user_id, toAccount(row)]));
      const sender = accounts.get(senderId);
      const receiver = accounts.get(receiverId);
      if (sender === undefined || receiver === undefined) throw new Error('Conta não encontrada.');
      const [previous] = await transaction.query<
        (RowDataPacket & {
          user_id: string;
          counterparty_id: string;
          guild_id: string | null;
          amount: string;
          balance_after: string;
          bank: string | null;
        })[]
      >(
        `SELECT user_id, counterparty_id, guild_id, amount, balance_after,
           JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.bank')) AS bank
         FROM economy_transactions WHERE idempotency_key = ? AND kind = 'transfer_out'`,
        [`${idempotencyKey}:out`],
      );
      if (previous !== undefined) {
        if (
          previous.user_id !== senderId ||
          previous.counterparty_id !== receiverId ||
          previous.guild_id !== guildId ||
          BigInt(previous.amount) !== -amount
        ) {
          throw new ValidationError('Esta operação já foi usada em outra transferência.');
        }
        return {
          wallet: BigInt(previous.balance_after),
          bank: previous.bank === null ? sender.bank : BigInt(previous.bank),
        };
      }
      if (sender.wallet < amount) throw new ValidationError('Saldo insuficiente na carteira.');

      await transaction.query<ResultSetHeader>(
        'UPDATE economia_usuarios SET carteira = ? WHERE user_id = ?',
        [storedBalance(sender.wallet - amount), senderId],
      );
      await transaction.query<ResultSetHeader>(
        'UPDATE economia_usuarios SET carteira = ? WHERE user_id = ?',
        [storedBalance(receiver.wallet + amount), receiverId],
      );
      await transaction.query<ResultSetHeader>(
        `INSERT INTO economy_transactions
           (user_id, counterparty_id, guild_id, kind, amount, balance_after, idempotency_key, metadata)
         VALUES (?, ?, ?, 'transfer_out', ?, ?, ?, JSON_OBJECT('bank', ?)), (?, ?, ?, 'transfer_in', ?, ?, ?, JSON_OBJECT('bank', ?))`,
        [
          senderId,
          receiverId,
          guildId,
          (-amount).toString(),
          (sender.wallet - amount).toString(),
          `${idempotencyKey}:out`,
          sender.bank.toString(),
          receiverId,
          senderId,
          guildId,
          amount.toString(),
          (receiver.wallet + amount).toString(),
          `${idempotencyKey}:in`,
          receiver.bank.toString(),
        ],
      );
      return { wallet: sender.wallet - amount, bank: sender.bank };
    });
  }

  public moveFunds(
    userId: string,
    requested: bigint | 'all',
    direction: 'deposit' | 'withdraw',
    operationId?: string,
  ): Promise<BalanceChange> {
    if (requested !== 'all') requirePositive(requested);
    return this.database.transaction(async (transaction) => {
      await ensureAccount(transaction, userId);
      const rows = await transaction.query<AccountRow[]>(
        `SELECT user_id, carteira, banco, xp, level, ultima_daily, ultima_trabalhar, sobre_mim
           FROM economia_usuarios WHERE user_id = ? FOR UPDATE`,
        [userId],
      );
      const account = accountFromRows(rows);
      const receipt = await findReceipt(transaction, operationId, {
        userId,
        kind: direction,
        requested: requested.toString(),
      });
      if (receipt) return receipt.balance;
      const amount =
        requested === 'all' ? (direction === 'deposit' ? account.wallet : account.bank) : requested;
      requirePositive(amount);
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
        [storedBalance(wallet), storedBalance(bank), userId],
      );
      await recordChange(
        transaction,
        userId,
        direction,
        wallet - account.wallet,
        { wallet, bank },
        operationId,
        undefined,
        { requested: requested.toString() },
      );
      return { wallet, bank };
    });
  }

  public changeBalance(
    userId: string,
    delta: bigint,
    destination: 'wallet' | 'bank',
    operationId?: string,
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
      const kind = `admin_${destination}`;
      const receipt = await findReceipt(transaction, operationId, {
        userId,
        kind,
        requested: delta.toString(),
      });
      if (receipt) return receipt.balance;
      const wallet = destination === 'wallet' ? account.wallet + delta : account.wallet;
      const bank = destination === 'bank' ? account.bank + delta : account.bank;
      if (wallet < 0n || bank < 0n)
        throw new ValidationError('A operação deixaria o saldo negativo.');
      await transaction.query<ResultSetHeader>(
        'UPDATE economia_usuarios SET carteira = ?, banco = ? WHERE user_id = ?',
        [storedBalance(wallet), storedBalance(bank), userId],
      );
      await recordChange(
        transaction,
        userId,
        kind,
        delta,
        { wallet, bank },
        operationId,
        undefined,
        { requested: delta.toString() },
      );
      return { wallet, bank };
    });
  }

  public purchaseItem(
    userId: string,
    guildId: string,
    itemId: number,
    operationId?: string,
  ): Promise<{ readonly itemName: string; readonly balance: BalanceChange }> {
    if (!Number.isSafeInteger(itemId) || itemId <= 0) throw new ValidationError('Item inválido.');
    return this.database.transaction(async (transaction) => {
      await ensureAccount(transaction, userId);
      const receipt = await findReceipt(transaction, operationId, {
        userId,
        kind: 'purchase',
        guildId,
        requested: String(itemId),
      });
      if (receipt) {
        if (receipt.itemName === null) throw new ValidationError('Recibo de compra incompleto.');
        return { itemName: receipt.itemName, balance: receipt.balance };
      }
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
      await recordChange(
        transaction,
        userId,
        'purchase',
        -price,
        { wallet, bank: account.bank },
        operationId,
        guildId,
        { requested: String(itemId), item_name: item.item_nome },
      );
      return { itemName: item.item_nome, balance: { wallet, bank: account.bank } };
    });
  }

  public settleWager(
    userId: string,
    stake: bigint,
    won: boolean,
    xp: number,
    operationId?: string,
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
      const wagerDelta = won ? stake : -stake;
      const { xp: newXp, level, bonus } = applyExperience(account, won ? xp : 0);
      const wallet = account.wallet + wagerDelta + bonus;
      await transaction.query<ResultSetHeader>(
        'UPDATE economia_usuarios SET carteira = ?, xp = ?, level = ? WHERE user_id = ?',
        [storedBalance(wallet), newXp, level, userId],
      );
      await recordChange(
        transaction,
        userId,
        'wager',
        wagerDelta,
        { wallet: account.wallet + wagerDelta, bank: account.bank },
        operationId,
      );
      if (bonus > 0n)
        await recordChange(transaction, userId, 'level_up', bonus, { wallet, bank: account.bank });
      return { wallet, bank: account.bank };
    });
  }
}
