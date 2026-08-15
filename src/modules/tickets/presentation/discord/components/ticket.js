const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');

const ephemeral = (content) => ({ content, flags: MessageFlags.Ephemeral });
const isAdministrator = (interaction) =>
  interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
  interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

const ticketConfig = async (guildId) =>
  (
    await query(
      `SELECT category_id, support_role_id, logs_channel_id, panel_channel_id,
              embed_title, embed_description, embed_color, ticket_message
         FROM tickets_config WHERE guild_id = ?`,
      [guildId],
    )
  )[0];

const sendLog = async (guild, channelId, embed) => {
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => undefined);
  if (channel?.isSendable()) await channel.send({ embeds: [embed] });
};

module.exports = {
  async execute(interaction) {
    if (!interaction.inGuild()) return;
    const { customId, guild, user } = interaction;

    if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
      if (!isAdministrator(interaction)) return interaction.reply(ephemeral('❌ Acesso negado.'));
      const value = interaction.values[0];
      const column = {
        select_ticket_category: 'category_id',
        select_ticket_logs: 'logs_channel_id',
        select_ticket_panel: 'panel_channel_id',
        select_ticket_role: 'support_role_id',
      }[customId];
      if (!column || !value) return;
      await query(
        `INSERT INTO tickets_config (guild_id, ${column}) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE ${column} = VALUES(${column})`,
        [guild.id, value],
      );
      return interaction.reply(
        ephemeral('✅ Configuração salva. Execute `/setup-tickets` para revisar.'),
      );
    }

    if (interaction.isButton() && customId === 'open_ticket') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const lockName = `wardizitto:ticket:${guild.id}:${user.id}`;
      const lock = await query('SELECT GET_LOCK(?, 5) AS acquired', [lockName]);
      if (Number(lock[0]?.acquired) !== 1)
        return interaction.editReply('⏳ Tente novamente em instantes.');
      let createdChannel;
      try {
        const config = await ticketConfig(guild.id);
        if (!config?.category_id || !config?.support_role_id) {
          return interaction.editReply('❌ O sistema de tickets ainda não está configurado.');
        }
        const existing = (
          await query(
            `SELECT channel_id FROM tickets
              WHERE guild_id = ? AND user_id = ? AND status = 'open' LIMIT 1`,
            [guild.id, user.id],
          )
        )[0];
        if (existing)
          return interaction.editReply(`Você já possui um ticket: <#${existing.channel_id}>`);

        createdChannel = await guild.channels.create({
          name: `ticket-${user.username}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .slice(0, 90),
          type: ChannelType.GuildText,
          parent: config.category_id,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
              ],
            },
            {
              id: config.support_role_id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.AttachFiles,
              ],
            },
          ],
          reason: `Ticket aberto por ${user.tag}`,
        });
        await query('INSERT INTO tickets (guild_id, channel_id, user_id) VALUES (?, ?, ?)', [
          guild.id,
          createdChannel.id,
          user.id,
        ]);
        const controls = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Fechar')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('Assumir')
            .setStyle(ButtonStyle.Success),
        );
        await createdChannel.send({
          content: `<@&${config.support_role_id}> ${user}`,
          embeds: [
            new EmbedBuilder()
              .setTitle(config.embed_title || 'Ticket aberto')
              .setDescription(config.ticket_message || 'Descreva sua solicitação com detalhes.')
              .setColor(config.embed_color || '#2f3136'),
          ],
          components: [controls],
        });
        await sendLog(
          guild,
          config.logs_channel_id,
          new EmbedBuilder()
            .setTitle('Ticket aberto')
            .setColor('Green')
            .setDescription(`${user} abriu ${createdChannel}.`)
            .setTimestamp(),
        );
        return interaction.editReply(`✅ Ticket criado: ${createdChannel}`);
      } catch (error) {
        if (createdChannel) await createdChannel.delete().catch(() => undefined);
        throw error;
      }
    }

    if (interaction.isButton() && ['close_ticket', 'claim_ticket'].includes(customId)) {
      const ticket = (
        await query(
          `SELECT user_id, status, claimed_by FROM tickets
            WHERE guild_id = ? AND channel_id = ? LIMIT 1`,
          [guild.id, interaction.channelId],
        )
      )[0];
      if (!ticket || ticket.status !== 'open')
        return interaction.reply(ephemeral('❌ Ticket inválido.'));
      const config = await ticketConfig(guild.id);
      const support =
        interaction.member.roles.cache.has(config?.support_role_id) || isAdministrator(interaction);

      if (customId === 'claim_ticket') {
        if (!support)
          return interaction.reply(ephemeral('❌ Apenas a equipe de suporte pode assumir.'));
        await query("UPDATE tickets SET claimed_by = ? WHERE channel_id = ? AND status = 'open'", [
          user.id,
          interaction.channelId,
        ]);
        const controls = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Fechar')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('Assumido')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        );
        await interaction.update({ components: [controls] });
        return interaction.followUp(ephemeral(`✅ Ticket assumido por ${user}.`));
      }

      if (!support && user.id !== ticket.user_id) {
        return interaction.reply(
          ephemeral('❌ Apenas o autor ou a equipe de suporte pode fechar.'),
        );
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await query(
        `UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ?
          WHERE channel_id = ? AND status = 'open'`,
        [user.id, interaction.channelId],
      );
      await sendLog(
        guild,
        config?.logs_channel_id,
        new EmbedBuilder()
          .setTitle('Ticket fechado')
          .setColor('Red')
          .setDescription(`<@${ticket.user_id}> · fechado por ${user}`)
          .setTimestamp(),
      );
      await interaction.editReply('✅ Ticket fechado. O canal será removido em 5 segundos.');
      const timer = setTimeout(() => interaction.channel?.delete().catch(() => undefined), 5_000);
      timer.unref();
      return;
    }

    if (interaction.isButton() && customId === 'config_ticket_appearance') {
      if (!isAdministrator(interaction)) return interaction.reply(ephemeral('❌ Acesso negado.'));
      const modal = new ModalBuilder()
        .setCustomId('modal_ticket_appearance')
        .setTitle('Aparência do ticket');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embed_title')
            .setLabel('Título')
            .setMaxLength(255)
            .setStyle(TextInputStyle.Short)
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embed_description')
            .setLabel('Descrição do painel')
            .setMaxLength(2000)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('embed_color')
            .setLabel('Cor hexadecimal (#5865F2)')
            .setMaxLength(7)
            .setStyle(TextInputStyle.Short)
            .setRequired(false),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('ticket_message')
            .setLabel('Mensagem do ticket')
            .setMaxLength(2000)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false),
        ),
      );
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === 'modal_ticket_appearance') {
      if (!isAdministrator(interaction)) return interaction.reply(ephemeral('❌ Acesso negado.'));
      const color = interaction.fields.getTextInputValue('embed_color').trim() || '#2f3136';
      if (!/^#[0-9a-f]{6}$/i.test(color))
        return interaction.reply(ephemeral('❌ Cor hexadecimal inválida.'));
      await query(
        `UPDATE tickets_config
            SET embed_title = ?, embed_description = ?, embed_color = ?, ticket_message = ?
          WHERE guild_id = ?`,
        [
          interaction.fields.getTextInputValue('embed_title').trim() || '🎫 Central de Suporte',
          interaction.fields.getTextInputValue('embed_description').trim(),
          color,
          interaction.fields.getTextInputValue('ticket_message').trim(),
          guild.id,
        ],
      );
      return interaction.reply(ephemeral('✅ Aparência atualizada.'));
    }

    if (interaction.isButton() && customId === 'send_ticket_panel') {
      if (!isAdministrator(interaction)) return interaction.reply(ephemeral('❌ Acesso negado.'));
      const config = await ticketConfig(guild.id);
      const channel = config?.panel_channel_id
        ? await guild.channels.fetch(config.panel_channel_id).catch(() => undefined)
        : undefined;
      if (channel?.isSendable() !== true) return interaction.reply(ephemeral('❌ Canal inválido.'));
      const message = await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(config.embed_title || '🎫 Central de Suporte')
            .setDescription(config.embed_description || 'Clique abaixo para abrir um ticket.')
            .setColor(config.embed_color || '#2f3136'),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('open_ticket')
              .setLabel('Abrir ticket')
              .setStyle(ButtonStyle.Primary),
          ),
        ],
      });
      await query('UPDATE tickets_config SET panel_message_id = ? WHERE guild_id = ?', [
        message.id,
        guild.id,
      ]);
      return interaction.reply(ephemeral('✅ Painel publicado.'));
    }
  },
};
