const { EmbedBuilder, MessageFlags } = require('discord.js');
const { isOwner } = require('../../../../../core/security/owner.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');

module.exports = {
  async execute(interaction) {
    if (!interaction.isButton()) return;
    const approve = interaction.customId.startsWith('aprovar_fanart_');
    const reject = interaction.customId.startsWith('rejeitar_fanart_');
    if (!approve && !reject) return;
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Acesso negado.', flags: MessageFlags.Ephemeral });
    }

    const authorId = interaction.customId.split('_')[2];
    if (!authorId || !/^\d{17,20}$/.test(authorId) || interaction.message.embeds.length === 0) {
      return interaction.reply({
        content: '❌ A solicitação de revisão é inválida.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const embed = EmbedBuilder.from(interaction.message.embeds[0]);

    if (approve) {
      const channelId = interaction.client.services.config.FAN_ART_PUBLIC_CHANNEL_ID;
      const channel = channelId
        ? await interaction.client.channels.fetch(channelId).catch(() => undefined)
        : undefined;
      if (channel?.isSendable() !== true) {
        return interaction.reply({
          content: '❌ O canal público não está configurado.',
          flags: MessageFlags.Ephemeral,
        });
      }
      embed.setColor('Green').setTitle('🎉 Fanart aprovada');
      await channel.send({ embeds: [embed] });
      await interaction.message.edit({ embeds: [embed], components: [] });
      return interaction.reply({
        content: '✅ Fanart aprovada e publicada.',
        flags: MessageFlags.Ephemeral,
      });
    }

    embed.setColor('Red').addFields({ name: 'Status', value: 'Fanart rejeitada.' });
    await query(
      `INSERT INTO avisos (guild_id, user_id, quantidade)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE quantidade = quantidade + 1`,
      [interaction.guildId ?? 'global', authorId],
    );
    const author = await interaction.client.users.fetch(authorId).catch(() => undefined);
    await author?.send('Sua fanart foi rejeitada pela equipe de revisão.').catch(() => undefined);
    await interaction.message.edit({ embeds: [embed], components: [] });
    return interaction.reply({
      content: '🚫 Fanart rejeitada.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
