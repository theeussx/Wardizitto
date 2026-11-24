import {
  SlashCommandBuilder,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';

export const data = new SlashCommandBuilder()
  .setName('trabalhar')
  .setDescription('💼 Trabalhe para ganhar Wardcoins e XP.');

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: WardizittoClient,
): Promise<void> {
  const reward = BigInt(Math.floor(Math.random() * 300) + 200);
  const xpGain = Math.floor(Math.random() * 30) + 20;
  await interaction.deferReply();
  const result = await client.services.economy.claimWork(
    interaction.user.id,
    reward,
    xpGain,
    60 * 60 * 1000,
  );
  const container = new ContainerBuilder();
  if (!result.available) {
    const minutes = Math.max(1, Math.ceil(result.retryAfterMs / 60_000));
    container
      .setAccentColor(0xed4245)
      .addTextDisplayComponents((text) =>
        text.setContent(`## ⏳ Descanse um pouco\nVolte em **${String(minutes)} minutos**.`),
      );
  } else {
    container
      .setAccentColor(0x3498db)
      .addTextDisplayComponents((text) => text.setContent('## 💼 Trabalho concluído'))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents((text) =>
        text.setContent(
          `Salário: **${reward.toLocaleString('pt-BR')} Wardcoins**\nXP: **+${String(result.value.xpGain)}**\nSaldo: **${result.value.balance.wallet.toLocaleString('pt-BR')}**`,
        ),
      );
    if (result.value.levelBonus > 0n) {
      container.addTextDisplayComponents((text) =>
        text.setContent(
          `Nível **${String(result.value.level)}** alcançado. Bônus de **${result.value.levelBonus.toLocaleString('pt-BR')} Wardcoins**.`,
        ),
      );
    }
  }
  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
}
