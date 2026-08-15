const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require('discord.js');
const {
  LabelBuilder,
  Colors,
  emoji,
} = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('placar')
    .setDescription('「Utilidades」Veja estatísticas de jogo.')
    .addSubcommand((sub) =>
      sub.setName('ranking').setDescription('Exibe o ranking geral dos jogadores.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('usuário')
        .setDescription('Exibe o placar de um usuário específico.')
        .addUserOption((option) =>
          option.setName('jogador').setDescription('Jogador para consultar').setRequired(false),
        ),
    ),

  async execute(interaction) {
    const { query } = require('../../../../../infrastructure/database/legacy.js');
    const sub = interaction.options.getSubcommand();

    // Emojis
    const emojiStar = emoji('eg_star');
    const emojiBot = emoji('eg_bot');
    const emojiUser = emoji('eg_member');
    const emojiLeft = emoji('icons_leftarrow');
    const emojiRight = emoji('icons_rightarrow');

    // ===== /placar usuário =====
    if (sub === 'usuário') {
      const user = interaction.options.getUser('jogador') || interaction.user;

      try {
        // Busca ambas as estatísticas em paralelo
        const [botRows, uvsRows] = await Promise.all([
          query(
            `SELECT wins, draws, losses, facil_wins, facil_draws, facil_losses,
                    medio_wins, medio_draws, medio_losses,
                    dificil_wins, dificil_draws, dificil_losses
               FROM bot_stats WHERE user_id = ?`,
            [user.id],
          ),
          query('SELECT wins, draws, losses FROM uvs_stats WHERE user_id = ?', [user.id]),
        ]);

        const bot = botRows[0] || {};
        const pvp = uvsRows[0] || {};

        const label = new LabelBuilder()
          .setTitle(`${emojiStar} Placar de ${user.username}`)
          .setColor(Colors.Blurple)
          .addField(
            `${emojiBot} Contra o Bot`,
            `**Vitórias:** ${bot.wins || 0}\n**Empates:** ${bot.draws || 0}\n**Derrotas:** ${bot.losses || 0}\n\n` +
              `**Fácil:** ${bot.facil_wins || 0}/${bot.facil_draws || 0}/${bot.facil_losses || 0}\n` +
              `**Médio:** ${bot.medio_wins || 0}/${bot.medio_draws || 0}/${bot.medio_losses || 0}\n` +
              `**Difícil:** ${bot.dificil_wins || 0}/${bot.dificil_draws || 0}/${bot.dificil_losses || 0}`,
            true,
          )
          .addField(
            `${emojiUser} Contra outros`,
            `**Vitórias:** ${pvp.wins || 0}\n**Empates:** ${pvp.draws || 0}\n**Derrotas:** ${pvp.losses || 0}`,
            true,
          );

        return interaction.reply({
          components: [label.build()],
          flags: MessageFlags.IsComponentsV2,
        });
      } catch (error) {
        interaction.client.services.logger.error('❌ Erro ao buscar estatísticas:', error);
        return interaction.reply({
          content: 'Ocorreu um erro ao buscar as estatísticas.',
          ephemeral: true,
        });
      }
    }

    // ===== /placar ranking =====
    try {
      // Busca ambas as rankings em paralelo
      const [botRanking, uvsRanking] = await Promise.all([
        query(`SELECT user_id, wins FROM bot_stats ORDER BY wins DESC LIMIT 100`),
        query(`SELECT user_id, wins FROM uvs_stats ORDER BY wins DESC LIMIT 100`),
      ]);

      const paginas = [];
      const totalPaginas = Math.max(
        1,
        Math.ceil(Math.max(botRanking.length, uvsRanking.length) / 10),
      );

      // Gera as páginas do ranking
      for (let page = 0; page < totalPaginas; page++) {
        const botSlice = botRanking.slice(page * 10, (page + 1) * 10);
        const uvsSlice = uvsRanking.slice(page * 10, (page + 1) * 10);

        const botDesc = botSlice.length
          ? botSlice
              .map(
                (user, i) =>
                  `**${page * 10 + i + 1}. <@${user.user_id}>** - ${user.wins || 0} vitórias`,
              )
              .join('\n')
          : '*Nenhum jogador registrado.*';

        const uvsDesc = uvsSlice.length
          ? uvsSlice
              .map(
                (user, i) =>
                  `**${page * 10 + i + 1}. <@${user.user_id}>** - ${user.wins || 0} vitórias`,
              )
              .join('\n')
          : '*Nenhum jogador registrado.*';

        paginas.push(
          new LabelBuilder()
            .setTitle(`${emojiStar} Ranking de Jogadores`)
            .setColor(Colors.Blurple)
            .addField(`${emojiBot} Contra o Bot`, botDesc)
            .addField(`${emojiUser} Contra Usuários`, uvsDesc)
            .setFooter(`Página ${page + 1} de ${totalPaginas}`),
        );
      }

      // Controle de paginação
      let paginaAtual = 0;
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('anterior')
          .setEmoji(emojiLeft)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId('proximo')
          .setEmoji(emojiRight)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(paginas.length <= 1),
      );

      const msg = await interaction.reply({
        components: [paginas[paginaAtual].build(), row],
        flags: MessageFlags.IsComponentsV2,
        fetchReply: true,
      });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000,
      });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: '❌ Apenas quem usou o comando pode interagir.',
            ephemeral: true,
          });
        }

        paginaAtual += i.customId === 'proximo' ? 1 : -1;

        row.components[0].setDisabled(paginaAtual === 0);
        row.components[1].setDisabled(paginaAtual === paginas.length - 1);

        await i.update({
          components: [paginas[paginaAtual].build(), row],
          flags: MessageFlags.IsComponentsV2,
        });
      });

      collector.on('end', async () => {
        try {
          await msg.edit({
            components: [paginas[paginaAtual].build()],
            flags: MessageFlags.IsComponentsV2,
          });
        } catch (error) {
          interaction.client.services.logger.error('❌ Erro ao remover componentes:', error);
        }
      });
    } catch (error) {
      interaction.client.services.logger.error('❌ Erro ao gerar ranking:', error);
      interaction.reply({
        content: 'Ocorreu um erro ao gerar o ranking.',
        ephemeral: true,
      });
    }
  },
};
