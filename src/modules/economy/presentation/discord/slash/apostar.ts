import { ValidationError } from '../../../../../core/errors/app-error.js';
import {
  SlashCommandBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';

export const data = new SlashCommandBuilder()
  .setName('apostar')
  .setDescription('🎰 Aposte Wardcoins em cara ou coroa.')
  .addIntegerOption((option) =>
    option.setName('quantia').setDescription('Valor da aposta.').setRequired(true).setMinValue(100),
  )
  .addStringOption((option) =>
    option
      .setName('escolha')
      .setDescription('Sua escolha.')
      .setRequired(true)
      .addChoices({ name: 'Cara', value: 'cara' }, { name: 'Coroa', value: 'coroa' }),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: WardizittoClient,
): Promise<void> {
  const amount = BigInt(interaction.options.getInteger('quantia', true));
  const choice = interaction.options.getString('escolha', true);
  if (choice !== 'cara' && choice !== 'coroa') throw new ValidationError('Escolha inválida.');
  const outcome = Math.random() < 0.5 ? 'cara' : 'coroa';
  const won = choice === outcome;
  const xp = won ? Math.floor(Math.random() * 15) + 5 : 0;
  await interaction.deferReply();
  const balance = await client.services.economy.settleWager(
    interaction.user.id,
    amount,
    won,
    xp,
    interaction.id,
  );
  const container = new ContainerBuilder()
    .setAccentColor(won ? 0x2ecc71 : 0xe74c3c)
    .addTextDisplayComponents((text) => text.setContent(`## 🎰 ${outcome.toUpperCase()}`))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents((text) =>
      text.setContent(
        won
          ? `🎉 Você ganhou **${amount.toLocaleString('pt-BR')}** Wardcoins e **${String(xp)} XP**.`
          : `Você perdeu **${amount.toLocaleString('pt-BR')}** Wardcoins.`,
      ),
    )
    .addTextDisplayComponents((text) =>
      text.setContent(`Saldo atual: **${balance.wallet.toLocaleString('pt-BR')}**`),
    );
  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
}
