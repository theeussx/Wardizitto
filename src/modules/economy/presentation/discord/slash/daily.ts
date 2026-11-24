import {
  SlashCommandBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';

const formatDuration = (milliseconds: number): string => {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.ceil((milliseconds % 3_600_000) / 60_000);
  return `${String(hours)}h ${String(minutes)}m`;
};

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('📅 Resgate sua recompensa diária de Wardcoins.');

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: WardizittoClient,
): Promise<void> {
  await interaction.deferReply();
  const reward = 1_500n;
  const result = await client.services.economy.claimDaily(
    interaction.user.id,
    reward,
    24 * 60 * 60 * 1000,
  );
  const container = new ContainerBuilder();
  if (!result.available) {
    container
      .setAccentColor(0xed4245)
      .addTextDisplayComponents((text) =>
        text.setContent(
          `## ⏳ Recompensa indisponível\nVolte em **${formatDuration(result.retryAfterMs)}**.`,
        ),
      );
  } else {
    container
      .setAccentColor(0x9b59b6)
      .addTextDisplayComponents((text) => text.setContent('## 📅 Recompensa diária'))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents((text) =>
        text.setContent(
          `Você recebeu **${reward.toLocaleString('pt-BR')} Wardcoins**.\nSaldo: **${result.value.wallet.toLocaleString('pt-BR')}**`,
        ),
      );
  }
  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
}
