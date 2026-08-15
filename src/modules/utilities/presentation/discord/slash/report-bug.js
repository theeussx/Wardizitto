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
    .setName('reportar-bug')
    .setDescription('Reporte um bug diretamente à equipe do bot.')
    .addStringOption((option) =>
      option
        .setName('descricao')
        .setDescription('Explique o bug detalhadamente.')
        .setMinLength(10)
        .setMaxLength(1000)
        .setRequired(true),
    )
    .addAttachmentOption((option) =>
      option.setName('imagem').setDescription('Imagem do bug (opcional).'),
    ),

  async execute(interaction) {
    const channelId = interaction.client.services.config.BUG_REPORT_CHANNEL_ID;
    const description = interaction.options.getString('descricao', true);
    const image = interaction.options.getAttachment('imagem');
    if (image && (!image.contentType?.startsWith('image/') || image.size > 10 * 1024 * 1024)) {
      return interaction.reply({
        content: '❌ A evidência deve ser uma imagem de até 10 MB.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const channel = channelId
      ? await interaction.client.channels.fetch(channelId).catch(() => undefined)
      : undefined;
    if (channel?.isSendable() !== true) {
      return interaction.reply({
        content: '❌ O canal de bugs não está configurado.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🐞 Novo bug reportado')
      .addFields(
        {
          name: '👤 Usuário',
          value: `${interaction.user.tag} (\`${interaction.user.id}\`)`,
        },
        {
          name: '🌐 Servidor',
          value: `${interaction.guild?.name ?? 'DM'} (\`${interaction.guildId ?? 'DM'}\`)`,
        },
        { name: '📝 Descrição', value: description },
      )
      .setColor('Red')
      .setTimestamp();
    if (image) embed.setImage(image.url);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirmar_bug_${interaction.id}`)
        .setLabel('Confirmar bug')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`resolver_bug_${interaction.id}`)
        .setLabel('Resolver bug')
        .setStyle(ButtonStyle.Primary),
    );
    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      content: '✅ Seu relatório foi enviado para a equipe.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
