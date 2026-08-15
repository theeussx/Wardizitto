const { MessageFlags } = require('discord.js');
const { isOwner } = require('../../../../../core/security/owner.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

// Extrai descrição, imagem e campos de um container V2 de fanart.
const parseFanart = (message) => {
  const container = message?.components?.[0]?.toJSON?.() ?? message?.components?.[0];
  const texts = [];
  let imageUrl = '';
  let authorField = '';
  const walk = (node) => {
    if (!node) return;
    if (node.type === 10) {
      const content = node.content;
      if (content.startsWith('**Autor**')) authorField = content;
      else if (!content.startsWith('## ') && !content.startsWith('-# ')) texts.push(content);
    }
    if (node.type === 12 && node.items?.[0]?.media?.url) imageUrl = node.items[0].media.url;
    for (const child of node.components || []) walk(child);
    for (const item of node.items || []) walk(item);
  };
  walk(container);
  return { description: texts[0] || '', imageUrl, authorField };
};

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
    if (!authorId || !/^\d{17,20}$/.test(authorId)) {
      return interaction.reply({
        content: '❌ A solicitação de revisão é inválida.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const parsed = parseFanart(interaction.message);
    if (!parsed.description) {
      return interaction.reply({
        content: '❌ A solicitação de revisão é inválida.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const buildLabel = (color, title) => {
      const label = new LabelBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(parsed.description);
      if (parsed.authorField) label.addText(parsed.authorField);
      if (parsed.imageUrl) label.setImage(parsed.imageUrl);
      return label;
    };

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
      const label = buildLabel(Colors.Green, '🎉 Fanart aprovada');
      await channel.send({
        components: [label.build()],
        flags: MessageFlags.IsComponentsV2,
      });
      await interaction.message.edit({
        components: [label.build()],
        flags: MessageFlags.IsComponentsV2,
      });
      return interaction.reply({
        content: '✅ Fanart aprovada e publicada.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const label = buildLabel(Colors.Red, '🎨 Fanart');
    label.addField('Status', 'Fanart rejeitada.');
    await query(
      `INSERT INTO avisos (guild_id, user_id, quantidade)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE quantidade = quantidade + 1`,
      [interaction.guildId ?? 'global', authorId],
    );
    const author = await interaction.client.users.fetch(authorId).catch(() => undefined);
    await author?.send('Sua fanart foi rejeitada pela equipe de revisão.').catch(() => undefined);
    await interaction.message.edit({
      components: [label.build()],
      flags: MessageFlags.IsComponentsV2,
    });
    return interaction.reply({
      content: '🚫 Fanart rejeitada.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
