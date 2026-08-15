const {
  SlashCommandBuilder,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
} = require('discord.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('🏆 Veja o ranking global dos usuários mais ricos.'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
    const results = await query(
      `SELECT user_id, (carteira + banco) AS total
         FROM economia_usuarios ORDER BY total DESC LIMIT 10`,
    );
    const users = await Promise.all(
      results.map((row) =>
        interaction.client.users
          .fetch(row.user_id)
          .catch(() => ({ username: 'Usuário desconhecido' })),
      ),
    );
    const ranking = results
      .map((row, index) => {
        const medal =
          index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
        return `${medal} **${users[index].username}** — ${BigInt(row.total).toLocaleString('pt-BR')} 🪙`;
      })
      .join('\n');
    const container = new ContainerBuilder()
      .setAccentColor(0xf1c40f)
      .addTextDisplayComponents((text) => text.setContent('## 🏆 Ranking global de Wardcoins'))
      .addSeparatorComponents(new SeparatorBuilder())
      .addTextDisplayComponents((text) => text.setContent(ranking || 'Nenhum usuário no ranking.'));
    await interaction.editReply({ components: [container] });
  },
};
