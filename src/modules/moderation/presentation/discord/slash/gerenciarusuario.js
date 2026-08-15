const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gerenciar-usuario')
    .setDescription('Gerencie advertências e ações disciplinares de um membro.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Membro a gerenciar.').setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    const target = interaction.options.getMember('usuario');
    if (!target || target.user.bot || target.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ Selecione outro membro válido.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const moderator = interaction.member;
    if (
      interaction.guild.ownerId !== interaction.user.id &&
      target.roles.highest.position >= moderator.roles.highest.position
    ) {
      return interaction.reply({
        content: '❌ Você não pode moderar um membro com cargo igual ou superior ao seu.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const firstRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`adminAction_timeout_${target.id}`)
        .setLabel('Castigar')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`adminAction_warn_${target.id}`)
        .setLabel('Advertir')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`adminAction_viewwarns_${target.id}`)
        .setLabel('Ver advertências')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`adminAction_clearwarns_${target.id}`)
        .setLabel('Limpar advertências')
        .setStyle(ButtonStyle.Secondary),
    );
    const secondRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`adminAction_kick_${target.id}`)
        .setLabel('Expulsar')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`adminAction_ban_${target.id}`)
        .setLabel('Banir')
        .setStyle(ButtonStyle.Danger),
    );
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#5865f2')
          .setTitle('Gerenciar membro')
          .setDescription(`Selecione uma ação para ${target}.`)
          .setThumbnail(target.displayAvatarURL()),
      ],
      components: [firstRow, secondRow],
      flags: MessageFlags.Ephemeral,
    });
  },
};
