const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enviar-fanart')
    .setDescription('Envie sua fanart para a equipe revisar.')
    .addStringOption((option) =>
      option
        .setName('descricao')
        .setDescription('Descrição da sua fanart.')
        .setMaxLength(1000)
        .setRequired(true),
    )
    .addAttachmentOption((option) =>
      option.setName('imagem').setDescription('Imagem da fanart.').setRequired(true),
    ),

  async execute(interaction) {
    const channelId = interaction.client.services.config.FAN_ART_REVIEW_CHANNEL_ID;
    const description = interaction.options.getString('descricao', true);
    const image = interaction.options.getAttachment('imagem', true);
    if (!image.contentType?.startsWith('image/') || image.size > 10 * 1024 * 1024) {
      return interaction.reply({
        content: '❌ Envie uma imagem válida de até 10 MB.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (!channelId) {
      return interaction.reply({
        content: '❌ O canal de revisão não está configurado.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const channel = await interaction.client.channels.fetch(channelId).catch(() => undefined);
    if (channel?.isSendable() !== true) {
      return interaction.reply({
        content: '❌ O canal de revisão está indisponível.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎨 Nova fanart')
      .setDescription(description)
      .setImage(image.url)
      .addFields({ name: 'Autor', value: `<@${interaction.user.id}> (\`${interaction.user.id}\`)` })
      .setColor('Purple')
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`aprovar_fanart_${interaction.user.id}`)
        .setLabel('Aprovar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`rejeitar_fanart_${interaction.user.id}`)
        .setLabel('Rejeitar')
        .setStyle(ButtonStyle.Danger),
    );
    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      content: '✅ Sua fanart foi enviada para revisão.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
