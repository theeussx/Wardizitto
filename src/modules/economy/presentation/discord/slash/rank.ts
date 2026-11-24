import {
  SlashCommandBuilder,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';

export const data = new SlashCommandBuilder()
  .setName('rank')
  .setDescription('🏆 Veja o ranking global dos usuários mais ricos.');

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: WardizittoClient,
): Promise<void> {
  await interaction.deferReply();
  const leaders = await client.services.economy.leaders();
  const lines = await Promise.all(
    leaders.map(async (entry, index) => {
      const member = await client.users.fetch(entry.userId).catch(() => undefined);
      const medal = ['🥇', '🥈', '🥉'][index] ?? `#${String(index + 1)}`;
      return `${medal} **${member?.username ?? 'Usuário desconhecido'}** — ${entry.total.toLocaleString('pt-BR')} 🪙`;
    }),
  );
  const ranking = lines.join('\n');
  const container = new ContainerBuilder()
    .setAccentColor(0xf1c40f)
    .addTextDisplayComponents((text) => text.setContent('## 🏆 Ranking global de Wardcoins'))
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents((text) => text.setContent(ranking || 'Nenhum usuário no ranking.'));
  await interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [container] });
}
