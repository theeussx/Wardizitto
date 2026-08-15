const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

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

      const label = new LabelBuilder()
        .setTitle('🛒 Loja Wardizitto')
        .setDescription(
          'Selecione um item no menu abaixo para ver detalhes e comprar.\n\n*Dica: Itens exclusivos estão disponíveis em nosso site!*',
        )
        .setColor(Colors.Orange)
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

      await interaction.editReply({
        components: [label.build(), row, rowButtons],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      interaction.client.services.logger.error('Erro em handler de compatibilidade.', error);
      await interaction.editReply('❌ Erro ao carregar a loja.');
    }
  },
};
