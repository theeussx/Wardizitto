const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require('discord.js');
const mysql = require('mysql2/promise');
const config = require('../../config.json');

// Configuração do pool de conexões MySQL
const pool = mysql.createPool({
  host: config.mariaDB.host,
  user: config.mariaDB.user,
  password: config.mariaDB.password,
  database: config.mariaDB.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('placar')
    .setDescription('「Utilidades」Veja estatísticas de jogo.')
    .addSubcommand(sub =>
      sub.setName('ranking')
        .setDescription('Exibe o ranking geral dos jogadores.')
    )
    .addSubcommand(sub =>
      sub.setName('usuário')
        .setDescription('Exibe o placar de um usuário específico.')
        .addUserOption(option =>
          option.setName('jogador')
            .setDescription('Jogador para consultar')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // Emojis
    const emojiStar = '<:eg_star:1353597159752077419>';
    const emojiBot = '<:eg_bot:1353597099563946026>';
    const emojiUser = '<:eg_member:1353597138411585628>';
    const emojiLeft = '<:icons_leftarrow:1353597444918607882>';
    const emojiRight = '<:icons_rightarrow:1353597358742568980>';

    // ===== /placar usuário =====
    if (sub === 'usuário') {
      const user = interaction.options.getUser('jogador') || interaction.user;
      
      try {
        const connection = await pool.getConnection();
        
        // Busca estatísticas contra o bot
        const [botRows] = await connection.query(
          `SELECT * FROM bot_stats WHERE user_id = ?`,
          [user.id]
        );
        
        // Busca estatísticas PvP
        const [uvsRows] = await connection.query(
          `SELECT * FROM uvs_stats WHERE user_id = ?`,
          [user.id]
        );
        
        connection.release();

        const bot = botRows[0] || {};
        const pvp = uvsRows[0] || {};

        const embed = new EmbedBuilder()
          .setTitle(`${emojiStar} Placar de ${user.username}`)
          .setColor(0x5865F2)
          .addFields(
            {
              name: `${emojiBot} Contra o Bot`,
              value: `**Vitórias:** ${bot.wins || 0}\n**Empates:** ${bot.draws || 0}\n**Derrotas:** ${bot.losses || 0}\n\n` +
                `**Fácil:** ${bot.facil_wins || 0}/${bot.facil_draws || 0}/${bot.facil_losses || 0}\n` +
                `**Médio:** ${bot.medio_wins || 0}/${bot.medio_draws || 0}/${bot.medio_losses || 0}\n` +
                `**Difícil:** ${bot.dificil_wins || 0}/${bot.dificil_draws || 0}/${bot.dificil_losses || 0}`,
              inline: true
            },
            {
              name: `${emojiUser} Contra outros`,
              value: `**Vitórias:** ${pvp.wins || 0}\n**Empates:** ${pvp.draws || 0}\n**Derrotas:** ${pvp.losses || 0}`,
              inline: true
            }
          );

        return interaction.reply({ embeds: [embed], ephemeral: false });
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return interaction.reply({
          content: 'Ocorreu um erro ao buscar as estatísticas.',
          ephemeral: true
        });
      }
    }

    // ===== /placar ranking =====
    try {
      const connection = await pool.getConnection();
      
      // Busca ranking contra o bot
      const [botRanking] = await connection.query(
        `SELECT user_id, wins FROM bot_stats ORDER BY wins DESC`
      );
      
      // Busca ranking PvP
      const [uvsRanking] = await connection.query(
        `SELECT user_id, wins FROM uvs_stats ORDER BY wins DESC`
      );
      
      connection.release();

      const paginas = [];
      const totalPaginas = Math.ceil(Math.max(botRanking.length, uvsRanking.length) / 10);

      // Gera as páginas do ranking
      for (let page = 0; page < totalPaginas; page++) {
        const botSlice = botRanking.slice(page * 10, (page + 1) * 10);
        const uvsSlice = uvsRanking.slice(page * 10, (page + 1) * 10);

        let botDesc = botSlice.length
          ? botSlice.map((user, i) => 
              `**${page * 10 + i + 1}. <@${user.user_id}>** - ${user.wins || 0} vitórias`
            ).join('\n')
          : '*Nenhum jogador registrado.*';

        let uvsDesc = uvsSlice.length
          ? uvsSlice.map((user, i) => 
              `**${page * 10 + i + 1}. <@${user.user_id}>** - ${user.wins || 0} vitórias`
            ).join('\n')
          : '*Nenhum jogador registrado.*';

        paginas.push(new EmbedBuilder()
          .setTitle(`${emojiStar} Ranking de Jogadores`)
          .setColor(0x5865F2)
          .addFields(
            { name: `${emojiBot} Contra o Bot`, value: botDesc },
            { name: `${emojiUser} Contra Usuários`, value: uvsDesc }
          )
          .setFooter({ text: `Página ${page + 1} de ${totalPaginas}` }));
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
          .setDisabled(paginas.length <= 1)
      );

      const msg = await interaction.reply({
        embeds: [paginas[paginaAtual]],
        components: [row],
        ephemeral: false,
        fetchReply: true
      });

      const collector = msg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000
      });

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: '❌ Apenas quem usou o comando pode interagir.', ephemeral: true });
        }

        paginaAtual += i.customId === 'proximo' ? 1 : -1;

        row.components[0].setDisabled(paginaAtual === 0);
        row.components[1].setDisabled(paginaAtual === paginas.length - 1);

        await i.update({
          embeds: [paginas[paginaAtual]],
          components: [row]
        });
      });

      collector.on('end', async () => {
        try {
          await msg.edit({ components: [] });
        } catch (error) {
          console.error('Erro ao remover componentes:', error);
        }
      });
    } catch (error) {
      console.error('Erro ao gerar ranking:', error);
      interaction.reply({
        content: 'Ocorreu um erro ao gerar o ranking.',
        ephemeral: true
      });
    }
  }
};