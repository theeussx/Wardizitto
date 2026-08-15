const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { LabelBuilder, emoji } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infor-emoji')
    .setDescription('「Utilidades」Exibe informações detalhadas sobre um emoji.')
    .addStringOption((option) =>
      option.setName('emoji').setDescription('Digite o emoji ou o ID do emoji.').setRequired(true),
    ),
  async execute(interaction) {
    const headerEmoji = emoji('eg_emojis');
    const emojiInput = interaction.options.getString('emoji');
    const emojiRegex = /<a?:\w+:(\d+)>/;
    const match = emojiInput.match(emojiRegex);

    if (match) {
      // Emoji customizado
      const emojiID = match[1];
      const emojiObj = interaction.client.emojis.cache.get(emojiID);

      if (!emojiObj) {
        return interaction.reply({
          content: 'Não consegui encontrar este emoji no cache.',
          ephemeral: true,
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Abrir emoji no navegador')
          .setURL(emojiObj.url)
          .setStyle(ButtonStyle.Link),
        new ButtonBuilder()
          .setCustomId('emoji_info')
          .setLabel('Ver informações')
          .setStyle(ButtonStyle.Primary),
      );

      const label = new LabelBuilder()
        .setColor(0x0099ff)
        .setTitle(`${headerEmoji} Informações do Emoji`)
        .setImage(emojiObj.url);

      const message = await interaction.reply({
        components: [label.build(), row],
        flags: MessageFlags.IsComponentsV2,
        fetchReply: true,
      });

      // Gerenciar interação com botões
      const filter = (i) => i.customId === 'emoji_info' && i.user.id === interaction.user.id;
      const collector = message.createMessageComponentCollector({ filter, time: 120000 }); // 2 minutos

      collector.on('collect', async (i) => {
        if (i.customId === 'emoji_info') {
          const infoLabel = new LabelBuilder()
            .setColor(0x0099ff)
            .setTitle(`${headerEmoji} Informações do Emoji`)
            .setThumbnail(emojiObj.url)
            .addField('Nome', emojiObj.name, true)
            .addField('ID', emojiObj.id, true)
            .addField('Animado', emojiObj.animated ? 'Sim' : 'Não', true)
            .addField('Criado em', `<t:${Math.floor(emojiObj.createdTimestamp / 1000)}:F>`, true)
            .addField('URL', `[Clique aqui](${emojiObj.url})`, true);
          await i.update({
            components: [infoLabel.build()],
            flags: MessageFlags.IsComponentsV2,
          });
        }
      });

      collector.on('end', async () => {
        await message
          .edit({ components: [label.build()], flags: MessageFlags.IsComponentsV2 })
          .catch(() => {});
      });
    }
  },
};
