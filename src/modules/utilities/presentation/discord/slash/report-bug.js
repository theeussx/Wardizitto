const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

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

    const label = new LabelBuilder()
      .setTitle('🐞 Novo bug reportado')
      .addField('👤 Usuário', `${interaction.user.tag} (\`${interaction.user.id}\`)`)
      .addField(
        '🌐 Servidor',
        `${interaction.guild?.name ?? 'DM'} (\`${interaction.guildId ?? 'DM'}\`)`,
      )
      .addField('📝 Descrição', description)
      .setColor(Colors.Red)
      .setTimestamp();
    if (image) label.setImage(image.url);

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
    await channel.send({
      components: [label.build(), row],
      flags: MessageFlags.IsComponentsV2,
    });
    await interaction.reply({
      content: '✅ Seu relatório foi enviado para a equipe.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
