import { ValidationError } from '../../../../../core/errors/app-error.js';
import {
  SlashCommandBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';

type Choice = 'pedra' | 'papel' | 'tesoura';
const choices: readonly Choice[] = ['pedra', 'papel', 'tesoura'];
const icons = { pedra: '✊', papel: '✋', tesoura: '✌️' };
const winsAgainst = { pedra: 'tesoura', papel: 'pedra', tesoura: 'papel' };

export const data = new SlashCommandBuilder()
  .setName('jokenpo')
  .setDescription('✊✋✌️ Jogue contra o bot valendo Wardcoins.')
  .addIntegerOption((option) =>
    option.setName('aposta').setDescription('Valor da aposta.').setRequired(true).setMinValue(50),
  )
  .addStringOption((option) =>
    option
      .setName('escolha')
      .setDescription('Sua jogada.')
      .setRequired(true)
      .addChoices(
        { name: 'Pedra ✊', value: 'pedra' },
        { name: 'Papel ✋', value: 'papel' },
        { name: 'Tesoura ✌️', value: 'tesoura' },
      ),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: WardizittoClient,
): Promise<void> {
  const stake = BigInt(interaction.options.getInteger('aposta', true));
  const userChoice = interaction.options.getString('escolha', true);
  if (userChoice !== 'pedra' && userChoice !== 'papel' && userChoice !== 'tesoura')
    throw new ValidationError('Jogada inválida.');
  const botChoice = choices[Math.floor(Math.random() * choices.length)] ?? 'pedra';
  const draw = userChoice === botChoice;
  const won = !draw && winsAgainst[userChoice] === botChoice;
  const xp = won ? Math.floor(Math.random() * 20) + 10 : 0;
  await interaction.deferReply();

  let balance;
  if (!draw) {
    balance = await client.services.economy.settleWager(
      interaction.user.id,
      stake,
      won,
      xp,
      interaction.id,
    );
  } else {
    balance = await client.services.economy.getAccount(interaction.user.id);
  }
  const result = draw ? 'Empate' : won ? 'Vitória' : 'Derrota';
  const container = new ContainerBuilder()
    .setAccentColor(draw ? 0xf1c40f : won ? 0x2ecc71 : 0xe74c3c)
    .addTextDisplayComponents((text) => text.setContent(`## ${result}`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents((text) =>
      text.setContent(
        `Você: ${icons[userChoice]} **${userChoice}**\nWardizitto: ${icons[botChoice]} **${botChoice}**`,
      ),
    )
    .addTextDisplayComponents((text) =>
      text.setContent(
        draw
          ? `A aposta foi devolvida. Saldo: **${balance.wallet.toLocaleString('pt-BR')}**`
          : `${won ? 'Ganho' : 'Perda'}: **${stake.toLocaleString('pt-BR')}** · Saldo: **${balance.wallet.toLocaleString('pt-BR')}**`,
      ),
    );
  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
}
