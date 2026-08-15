const {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const QRCode = require('qrcode');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('doar')
    .setDescription('「Utilidades」Ajude o Wardizitto a continuar online com uma doação via Pix!'),

  async execute(interaction) {
    const {
      PIX_KEY: pixKey,
      PIX_COPY_PASTE: pixCode,
      DONATION_LOG_CHANNEL_ID: logChannelId,
    } = interaction.client.services.config;
    if (!pixKey || !pixCode) {
      return interaction.reply({
        content: '❌ As doações não estão configuradas nesta instalação.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const qrBuffer = await QRCode.toBuffer(pixCode, { errorCorrectionLevel: 'H', width: 300 });
    const attachment = new AttachmentBuilder(qrBuffer, { name: 'pix.png' });
    const embed = new EmbedBuilder()
      .setColor('Green')
      .setTitle('💚 Apoie o projeto Wardizitto')
      .setDescription('Obrigado por considerar apoiar o projeto!')
      .addFields(
        { name: 'Chave Pix', value: `\`${pixKey}\`` },
        { name: 'Pix copia e cola', value: `\`\`\`${pixCode}\`\`\`` },
      )
      .setImage('attachment://pix.png')
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      files: [attachment],
      flags: MessageFlags.Ephemeral,
    });

    interaction.client.services.logger.audit('Comando de doação acessado.', {
      guildId: interaction.guildId,
      userId: interaction.user.id,
    });
    if (logChannelId) {
      const channel = await interaction.client.channels.fetch(logChannelId).catch(() => undefined);
      if (channel?.isSendable()) {
        await channel.send({
          content: `💚 ${interaction.user.tag} (\`${interaction.user.id}\`) abriu o painel de doação.`,
          allowedMentions: { parse: [] },
        });
      }
    }
  },
};
