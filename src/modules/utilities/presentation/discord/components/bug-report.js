const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { isOwner } = require('../../../../../core/security/owner.js');

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
    if ((!confirm && !resolve) || interaction.message.embeds.length === 0) return;

    const embed = EmbedBuilder.from(interaction.message.embeds[0]);
    const userField = embed.data.fields?.find((field) => field.name === '👤 Usuário');
    const originalUserId = userField?.value?.match(/\b(\d{17,20})\b/u)?.[1];

    if (confirm) {
      embed.setColor('Orange');
      if (!embed.data.fields?.some((field) => field.name === '🔍 Status')) {
        embed.addFields({ name: '🔍 Status', value: 'Bug confirmado.' });
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`resolver_bug_${interaction.message.id}`)
          .setLabel('Resolver bug')
          .setStyle(ButtonStyle.Primary),
      );
      await interaction.message.edit({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ Bug confirmado.', flags: MessageFlags.Ephemeral });
    }

    embed.setColor('Green').addFields({ name: '✅ Status final', value: 'Bug resolvido.' });
    await interaction.message.edit({ embeds: [embed], components: [] });
    if (originalUserId) {
      const user = await interaction.client.users.fetch(originalUserId).catch(() => undefined);
      await user
        ?.send('Obrigado pelo relatório! O bug informado foi resolvido.')
        .catch(() => undefined);
    }
    return interaction.reply({ content: '✅ Bug resolvido.', flags: MessageFlags.Ephemeral });
  },
};
