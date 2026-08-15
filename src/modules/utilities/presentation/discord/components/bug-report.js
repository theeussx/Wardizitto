const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { isOwner } = require('../../../../../core/security/owner.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

// Extrai título, campos e imagem de um container V2 de relatório de bug.
const parseBugReport = (message) => {
  const container = message?.components?.[0]?.toJSON?.() ?? message?.components?.[0];
  const fields = [];
  let title = '🐞 Bug reportado';
  let imageUrl = '';
  const walk = (node) => {
    if (!node) return;
    if (node.type === 10) {
      const content = node.content;
      if (content.startsWith('## ')) title = content.slice(3);
      else if (content.startsWith('**') && content.includes('\n')) {
        const index = content.indexOf('\n');
        fields.push({ name: content.slice(2, index - 2), value: content.slice(index + 1) });
      }
    }
    if (node.type === 12 && node.items?.[0]?.media?.url) imageUrl = node.items[0].media.url;
    for (const child of node.components || []) walk(child);
    for (const item of node.items || []) walk(item);
  };
  walk(container);
  const userField = fields.find((field) => field.name === '👤 Usuário');
  const userId = userField?.value?.match(/\b(\d{17,20})\b/u)?.[1];
  return { title, fields, imageUrl, userId };
};

const buildLabel = (parsed, color, statusField) => {
  const label = new LabelBuilder().setTitle(parsed.title).setColor(color);
  for (const field of parsed.fields) label.addField(field.name, field.value);
  if (statusField) label.addField(statusField.name, statusField.value);
  if (parsed.imageUrl) label.setImage(parsed.imageUrl);
  return label;
};

module.exports = {
  async execute(interaction) {
    if (!interaction.isButton() || !isOwner(interaction.user.id)) {
      if (interaction.isRepliable()) {
        await interaction.reply({ content: '❌ Acesso negado.', flags: MessageFlags.Ephemeral });
      }
      return;
    }
    const confirm = interaction.customId.startsWith('confirmar_bug_');
    const resolve = interaction.customId.startsWith('resolver_bug_');
    if (!confirm && !resolve) return;

    const parsed = parseBugReport(interaction.message);
    const originalUserId = parsed.userId;

    if (confirm) {
      const hasStatus = parsed.fields.some((field) => field.name === '🔍 Status');
      const statusField = hasStatus ? undefined : { name: '🔍 Status', value: 'Bug confirmado.' };
      const label = buildLabel(parsed, Colors.Orange, statusField);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`resolver_bug_${interaction.message.id}`)
          .setLabel('Resolver bug')
          .setStyle(ButtonStyle.Primary),
      );
      await interaction.message.edit({
        components: [label.build(), row],
        flags: MessageFlags.IsComponentsV2,
      });
      return interaction.reply({ content: '✅ Bug confirmado.', flags: MessageFlags.Ephemeral });
    }

    const label = buildLabel(parsed, Colors.Green, {
      name: '✅ Status final',
      value: 'Bug resolvido.',
    });
    await interaction.message.edit({
      components: [label.build()],
      flags: MessageFlags.IsComponentsV2,
    });
    if (originalUserId) {
      const user = await interaction.client.users.fetch(originalUserId).catch(() => undefined);
      await user
        ?.send('Obrigado pelo relatório! O bug informado foi resolvido.')
        .catch(() => undefined);
    }
    return interaction.reply({ content: '✅ Bug resolvido.', flags: MessageFlags.Ephemeral });
  },
};
