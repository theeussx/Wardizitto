import { readdir } from 'node:fs/promises';
import type { RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ValidationError } from '../../src/core/errors/app-error.js';
import { MigrationRunner } from '../../src/infrastructure/database/migration-runner.js';
import type { BalanceChange } from '../../src/modules/economy/domain/economy-account.js';
import { EconomyService } from '../../src/modules/economy/application/economy-service.js';
import {
  integrationEnabled,
  openTestDatabase,
  testLogger,
  type TestDatabase,
} from './database-fixture.js';

describe.runIf(integrationEnabled)('Wardcoins com InnoDB descartável', () => {
  let fixture: TestDatabase;
  let economy: EconomyService;
  let cleanup: (() => Promise<void>) | undefined;
  beforeAll(async () => {
    fixture = await openTestDatabase();
    cleanup = fixture.close;
    const files = await readdir('src/infrastructure/database/migrations');
    const count = files.filter((file) => file.endsWith('.sql')).length;
    const migrate = (): Promise<number> =>
      new MigrationRunner(fixture.database, testLogger).migrate();
    expect((await Promise.all([migrate(), migrate()])).sort((a, b) => a - b)).toEqual([0, count]);
    economy = new EconomyService(fixture.database);
  }, 60000);
  afterAll(async () => {
    await cleanup?.();
  });

  it('aplica uma única recompensa entre 24 solicitações concorrentes', async () => {
    const results = await Promise.all(
      Array.from({ length: 24 }, () => economy.claimDaily('daily', 1500n, 86_400_000)),
    );
    expect(results.filter((r) => r.available)).toHaveLength(1);
    expect((await economy.getAccount('daily')).wallet).toBe(1500n);
    expect(
      await fixture.database.query<RowDataPacket[]>(
        "SELECT amount, kind FROM economy_transactions WHERE user_id='daily'",
      ),
    ).toEqual([{ amount: '1500', kind: 'daily' }]);
  });
  it('conserva saldos BIGINT em transferências simultâneas nos dois sentidos', async () => {
    const balance = 9007199254740993n;
    await Promise.all(['one', 'two'].map((id) => economy.changeBalance(id, balance, 'wallet')));
    await Promise.all(
      Array.from({ length: 32 }, (_, i) =>
        economy.transfer(i % 2 ? 'one' : 'two', i % 2 ? 'two' : 'one', 1n, 'guild', String(i)),
      ),
    );
    expect((await economy.getAccount('one')).wallet).toBe(balance);
    expect((await economy.getAccount('two')).wallet).toBe(balance);
    expect(
      await fixture.database.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS total FROM economy_transactions WHERE kind IN ('transfer_in','transfer_out')",
      ),
    ).toEqual([{ total: '64' }]);
  });
  it('devolve o recibo original para redelivery e rejeita mudança de destinatário', async () => {
    await economy.changeBalance('from', 100n, 'wallet');
    await economy.moveFunds('from', 10n, 'deposit');
    const send = (): Promise<{ wallet: bigint; bank: bigint }> =>
      economy.transfer('from', 'to', 90n, null, 'receipt');
    const result = await Promise.all([send(), send()]);
    expect(result).toEqual([
      { wallet: 0n, bank: 10n },
      { wallet: 0n, bank: 10n },
    ]);
    await economy.moveFunds('from', 10n, 'withdraw');
    expect(await send()).toEqual(result[0]);
    await expect(economy.transfer('from', 'other', 90n, null, 'receipt')).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect((await economy.getAccount('to')).wallet).toBe(90n);
  });
  it('recupera o bônus histórico de nível na mesma transação do trabalho', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => economy.claimWork('worker', 200n, 500, 3600000)),
    );
    expect(results.filter((r) => r.available)).toHaveLength(1);
    expect(await economy.getAccount('worker')).toMatchObject({ level: 2, xp: 0, wallet: 2200n });
    expect(
      await fixture.database.query<RowDataPacket[]>(
        'SELECT kind, amount FROM economy_transactions WHERE user_id = ? ORDER BY id',
        ['worker'],
      ),
    ).toEqual([
      { kind: 'work', amount: '200' },
      { kind: 'level_up', amount: '2000' },
    ]);
  });
  it('repete o recibo da compra mesmo após alteração do catálogo e isola inventários', async () => {
    await fixture.database.query("INSERT INTO economia_loja(item_nome,preco) VALUES ('Capa',25)");
    await economy.changeBalance('buyer', 100n, 'wallet', 'credit');
    const purchase = (): Promise<unknown> => economy.purchaseItem('buyer', 'first', 1, 'purchase');
    const receipts = await Promise.all([purchase(), purchase()]);
    expect(receipts).toEqual(
      Array(2).fill({ itemName: 'Capa', balance: { wallet: 75n, bank: 0n } }),
    );
    await fixture.database.query(
      "UPDATE economia_loja SET item_nome='Novo', disponivel_web=FALSE WHERE id=1",
    );
    expect(await purchase()).toEqual(receipts[0]);
    await expect(economy.purchaseItem('buyer', 'second', 1, 'purchase')).rejects.toBeInstanceOf(
      ValidationError,
    );
    await fixture.database.query('UPDATE economia_loja SET disponivel_web=TRUE WHERE id=1');
    await economy.purchaseItem('buyer', 'second', 1, 'another');
    expect((await economy.getAccount('buyer')).wallet).toBe(50n);
    expect(
      await fixture.database.query<RowDataPacket[]>(
        'SELECT guild_id, quantidade FROM economia_inventario WHERE user_id=? ORDER BY guild_id',
        ['buyer'],
      ),
    ).toEqual([
      { guild_id: 'first', quantidade: 1 },
      { guild_id: 'second', quantidade: 1 },
    ]);
  });
  it('mantém recibos de ajuste, depósito total e saque com saldo posterior diferente', async () => {
    const credit = (): Promise<BalanceChange> =>
      economy.changeBalance('atm', 200n, 'wallet', 'adjustment');
    const deposit = (): Promise<BalanceChange> =>
      economy.moveFunds('atm', 'all', 'deposit', 'deposit-all');
    const withdrawal = (): Promise<BalanceChange> =>
      economy.moveFunds('atm', 30n, 'withdraw', 'withdraw');
    expect(await credit()).toEqual({ wallet: 200n, bank: 0n });
    const deposits = await Promise.all(Array.from({ length: 8 }, deposit));
    expect(deposits.every((r) => r.wallet === 0n && r.bank === 200n)).toBe(true);
    expect(await withdrawal()).toEqual({ wallet: 30n, bank: 170n });
    await economy.changeBalance('atm', 5n, 'bank');
    expect(await credit()).toEqual({ wallet: 200n, bank: 0n });
    expect(await deposit()).toEqual({ wallet: 0n, bank: 200n });
    expect(await withdrawal()).toEqual({ wallet: 30n, bank: 170n });
    await expect(economy.moveFunds('atm', 200n, 'deposit', 'deposit-all')).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(economy.changeBalance('atm', 200n, 'bank', 'adjustment')).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(await economy.getAccount('atm')).toMatchObject({ wallet: 30n, bank: 175n });
  });
  it('carrega profissão e patrimônio acima de BIGINT assinado sem criar uma conta na consulta de perfil', async () => {
    const max = (1n << 63n) - 1n;
    expect(await economy.findProfile('profile')).toBeUndefined();
    await economy.changeBalance('profile', max, 'bank');
    await economy.changeBalance('profile', max, 'wallet');
    await fixture.database.query(
      "INSERT INTO economia_profissoes (user_id, profissao) VALUES ('profile','Designer')",
    );
    expect(await economy.findProfile('profile')).toMatchObject({
      profession: 'Designer',
      wallet: max,
      bank: max,
    });
    expect((await economy.leaders())[0]).toEqual({ userId: 'profile', total: 2n * max });
  });
  it('não credita XP na derrota nem repete XP e bônus na reentrega de uma aposta', async () => {
    await economy.changeBalance('player', 1000n, 'wallet');
    await economy.settleWager('player', 100n, false, 20, 'loss');
    expect(await economy.getAccount('player')).toMatchObject({ level: 1, xp: 0, wallet: 900n });
    await economy.settleWager('player', 100n, true, 500, 'win');
    await expect(economy.settleWager('player', 100n, true, 500, 'win')).rejects.toThrow();
    expect(await economy.getAccount('player')).toMatchObject({ level: 2, xp: 0, wallet: 3000n });
  });
  it('reverte integralmente quando o saldo do destinatário excederia BIGINT', async () => {
    await economy.changeBalance('full', (1n << 63n) - 1n, 'wallet');
    await economy.changeBalance('small', 1n, 'wallet');
    await expect(economy.transfer('small', 'full', 1n, null, 'overflow')).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect((await economy.getAccount('small')).wallet).toBe(1n);
  });
});
