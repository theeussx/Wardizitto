const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('loja')
    .setDescription('Veja os itens disponíveis na loja do Wardizitto.'),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const items = await query(
        `SELECT id, item_nome, preco, descricao, tipo
           FROM economia_loja WHERE disponivel_web = TRUE
           ORDER BY id LIMIT 25`,
      );

      if (items.length === 0) {
        return interaction.editReply('🛒 A loja está vazia no momento. Volte mais tarde!');
      }

      const embed = new EmbedBuilder()
        .setTitle('🛒 Loja Wardizitto')
        .setDescription(
          'Selecione um item no menu abaixo para ver detalhes e comprar.\n\n*Dica: Itens exclusivos estão disponíveis em nosso site!*',
        )
        .setColor('#E67E22')
        .setThumbnail(interaction.client.user.displayAvatarURL());

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('buy_item_select')
        .setPlaceholder('Escolha um item para comprar...')
        .addOptions(
          items.map((item) => ({
            label: item.item_nome,
            description: `Preço: ${BigInt(item.preco).toLocaleString('pt-BR')} Wardcoins`,
            value: item.id.toString(),
            emoji: '📦',
          })),
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);
      const rowButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Visitar Loja Web')
          .setURL('https://wardizitto.app/shop')
          .setStyle(ButtonStyle.Link)
          .setDisabled(true),
      );

      await interaction.editReply({ embeds: [embed], components: [row, rowButtons] });
    } catch (error) {
      interaction.client.services.logger.error('Erro em handler de compatibilidade.', error);
      await interaction.editReply('❌ Erro ao carregar a loja.');
    }
  },
};
