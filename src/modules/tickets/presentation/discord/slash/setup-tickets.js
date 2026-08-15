const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Abre o painel de configuração do sistema de tickets.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config =
      (
        await query(
          `SELECT category_id, support_role_id, logs_channel_id, panel_channel_id
           FROM tickets_config WHERE guild_id = ?`,
          [interaction.guildId],
        )
      )[0] || {};
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuração de tickets')
      .setDescription('Configure cada item e, ao final, publique o painel.')
      .addFields(
        {
          name: 'Categoria',
          value: config.category_id ? `<#${config.category_id}>` : 'Não configurada',
          inline: true,
        },
        {
          name: 'Cargo de suporte',
          value: config.support_role_id ? `<@&${config.support_role_id}>` : 'Não configurado',
          inline: true,
        },
        {
          name: 'Canal de logs',
          value: config.logs_channel_id ? `<#${config.logs_channel_id}>` : 'Não configurado',
          inline: true,
        },
        {
          name: 'Canal do painel',
          value: config.panel_channel_id ? `<#${config.panel_channel_id}>` : 'Não configurado',
          inline: true,
        },
      )
      .setColor('#5865f2');
    const category = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('select_ticket_category')
        .setPlaceholder('Categoria dos tickets')
        .setChannelTypes(ChannelType.GuildCategory),
    );
    const logs = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('select_ticket_logs')
        .setPlaceholder('Canal de logs')
        .setChannelTypes(ChannelType.GuildText),
    );
    const panel = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('select_ticket_panel')
        .setPlaceholder('Canal do painel')
        .setChannelTypes(ChannelType.GuildText),
    );
    const role = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('select_ticket_role')
        .setPlaceholder('Cargo de suporte'),
    );
    const actions = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('config_ticket_appearance')
        .setLabel('Personalizar')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('send_ticket_panel')
        .setLabel('Publicar painel')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!(config.category_id && config.support_role_id && config.panel_channel_id)),
    );
    await interaction.reply({
      embeds: [embed],
      components: [category, logs, panel, role, actions],
      flags: MessageFlags.Ephemeral,
    });
  },
};
