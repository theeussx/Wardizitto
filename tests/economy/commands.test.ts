import { ApplicationCommandOptionType } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { data as daily } from '../../src/modules/economy/presentation/discord/slash/daily.js';
import { data as work } from '../../src/modules/economy/presentation/discord/slash/trabalhar.js';
import { data as coin } from '../../src/modules/economy/presentation/discord/slash/apostar.js';
import { data as jokenpo } from '../../src/modules/economy/presentation/discord/slash/jokenpo.js';
import { data as profile } from '../../src/modules/economy/presentation/discord/slash/perfil.js';
import { data as rank } from '../../src/modules/economy/presentation/discord/slash/rank.js';

import { inventoryDescription } from '../../src/modules/economy/presentation/discord/components/economy.js';

it('mantém o inventário dentro do limite do embed com nomes Unicode longos', () => {
  const items = Array.from({ length: 50 }, () => ({ name: '🌿'.repeat(100), quantity: 9999 }));
  const description = inventoryDescription(items);
  expect(description.length).toBeLessThanOrEqual(4096);
  expect(description).toContain('nesta lista');
  expect(inventoryDescription([])).toContain('vazio');
});

describe('contratos públicos dos comandos de economia', () => {
  it('mantém nomes históricos e perfil de usuário opcional', () => {
    expect(
      [daily, work, rank].map((command) => [command.toJSON().name, command.toJSON().options]),
    ).toEqual([
      ['daily', []],
      ['trabalhar', []],
      ['rank', []],
    ]);
    expect(profile.toJSON()).toMatchObject({
      name: 'perfil',
      options: [{ name: 'usuario', required: false, type: ApplicationCommandOptionType.User }],
    });
  });
  it.each([
    [coin, 'apostar', 'quantia', 100, ['cara', 'coroa']],
    [jokenpo, 'jokenpo', 'aposta', 50, ['pedra', 'papel', 'tesoura']],
  ] as const)(
    'preserva opções, apostas mínimas e escolhas de %s',
    (command, name, amount, min, values) => {
      expect(command.toJSON()).toMatchObject({
        name,
        options: [
          {
            name: amount,
            type: ApplicationCommandOptionType.Integer,
            min_value: min,
            required: true,
          },
          {
            name: 'escolha',
            type: ApplicationCommandOptionType.String,
            required: true,
            choices: values.map((value) => ({ value })),
          },
        ],
      });
    },
  );
});
