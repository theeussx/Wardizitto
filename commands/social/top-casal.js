const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { format, differenceInDays } = require('date-fns');
const { ptBR } = require('date-fns/locale');
const { pool } = require('../../handlers/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('top-casais')
    .setDescription('「Social」 Mostra os casais mais antigos do servidor.')
    .addIntegerOption(option =>
      option.setName('página')
        .setDescription('Página específica para visualizar')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const autorId = interaction.user.id;
    const itensPorPagina = 10;
    let paginaAtual = interaction.options.getInteger('página') || 1;

    const carregarEmbed = async (pagina) => {
      pagina = Math.max(1, pagina);

      // Total de registros
      const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM casamentos');
      const totalPaginas = Math.max(1, Math.ceil(total / itensPorPagina));
      pagina = Math.min(pagina, totalPaginas);

      const [casais] = await pool.query(
        'SELECT user_id, parceiro_id, data FROM casamentos ORDER BY data ASC LIMIT ? OFFSET ?',
        [itensPorPagina, (pagina - 1) * itensPorPagina]
      );

      let totalDiasTodosCasais = 0;

      const casaisFormatados = await Promise.all(
        casais.map(async (casal, index) => {
          try {
            const user1 = await interaction.client.users.fetch(casal.user_id).catch(() => null);
            const user2 = await interaction.client.users.fetch(casal.parceiro_id).catch(() => null);
            if (!user1 || !user2) return null;

            const dataCasamento = new Date(Number(casal.data));
            const dias = differenceInDays(new Date(), dataCasamento);
            totalDiasTodosCasais += dias;

            const dataFormatada = format(dataCasamento, 'dd/MM/yyyy', { locale: ptBR });

            return `**#${(pagina - 1) * itensPorPagina + index + 1}** - ${user1.username} ❤️ ${user2.username}\n` +
                   `⏳ ${dias} dias | 📅 ${dataFormatada}`;
          } catch {
            return null;
          }
        })
      );

      const lista = casaisFormatados.filter(Boolean).join('\n\n') || 'Nenhum casal encontrado.';

      const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle(`💑 Top Casais Mais Antigos - Página ${pagina}/${totalPaginas}`)
        .setDescription(lista)
        .addFields({
          name: '📊 Total de dias somados nesta página:',
          value: `${totalDiasTodosCasais} dias`,
          inline: false,
        })
        .setFooter({ text: `Total de ${total} casais registrados` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('anterior')
          .setLabel('◀️ Anterior')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pagina === 1),
        new ButtonBuilder()
          .setCustomId('atualizar')
          .setLabel('🔄 Atualizar')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('proxima')
          .setLabel('Próxima ▶️')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(pagina === totalPaginas)
      );

      return { embed, row, pagina, totalPaginas };
    };

    let { embed, row, pagina } = await carregarEmbed(paginaAtual);

    const reply = await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000, // 2 minutos
    });

    collector.on('collect', async i => {
      if (i.user.id !== autorId) {
        return i.reply({ content: '❌ Apenas quem usou o comando pode interagir com os botões.', ephemeral: true });
      }

      if (i.customId === 'anterior') pagina--;
      if (i.customId === 'proxima') pagina++;
      // Se for atualizar, mantém a mesma página

      const { embed: novoEmbed, row: novaRow } = await carregarEmbed(pagina);
      await i.update({ embeds: [novoEmbed], components: [novaRow] });
    });

    collector.on('end', async () => {
      if (reply.editable) {
        const desativado = new ActionRowBuilder().addComponents(
          row.components.map(botao => botao.setDisabled(true))
        );
        await reply.edit({ components: [desativado] }).catch(() => {});
      }
    });
  },
};