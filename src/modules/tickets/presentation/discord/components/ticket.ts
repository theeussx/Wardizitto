import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  LabelBuilder,
  TextInputStyle,
  MessageFlags,
  RESTJSONErrorCodes,
  type Interaction,
  type Guild,
  type InteractionReplyOptions,
} from 'discord.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { pool, query } from '../../../../../infrastructure/database/legacy.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';
import { discordTheme } from '../../../../../core/design/discord-theme.js';

import { ticketOpeningPanel } from '../ticket-opening-panel.js';
import { claimTicket } from '../../../application/claim-ticket.js';
import { withTicketLock } from '../../../application/ticket-lock.js';

interface ConfigRow extends RowDataPacket {
  category_id: string | null;
  support_role_id: string | null;
  logs_channel_id: string | null;
  panel_channel_id: string | null;
  panel_message_id: string | null;
  embed_title: string | null;
  embed_description: string | null;
  embed_color: string | null;
  ticket_message: string | null;
}
interface TicketRow extends RowDataPacket {
  user_id: string;
  status: string;
  claimed_by: string | null;
  channel_id: string;
}
const ephemeral = (content: string): InteractionReplyOptions => ({
  content,
  flags: MessageFlags.Ephemeral,
});
const configSql = `SELECT category_id, support_role_id, logs_channel_id, panel_channel_id, panel_message_id,
              embed_title, embed_description, embed_color, ticket_message
         FROM tickets_config WHERE guild_id = ?`;
const ticketConfig = async (guildId: string): Promise<ConfigRow | undefined> =>
  (await query<ConfigRow[]>(configSql, [guildId]))[0];

const sendLog = async (
  guild: Guild,
  channelId: string | null | undefined,
  embed: EmbedBuilder,
): Promise<void> => {
  if (!channelId) return;
  const channel = await guild.channels.fetch(channelId);
  if (channel?.isSendable()) await channel.send({ embeds: [embed] });
};

export async function execute(
  interaction: Interaction,
  client: WardizittoClient,
): Promise<unknown> {
  if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;
  if (!interaction.inCachedGuild() || !interaction.guild.available)
    return interaction.reply(ephemeral('Aguarde o servidor ficar disponível.'));
  const { customId, guild, user } = interaction;
  const canConfigure = interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);

  if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
    if (!canConfigure) return interaction.reply(ephemeral('❌ Acesso negado.'));
    const value = interaction.values[0];
    const columns: Readonly<Record<string, string>> = {
      select_ticket_category: 'category_id',
      select_ticket_logs: 'logs_channel_id',
      select_ticket_panel: 'panel_channel_id',
      select_ticket_role: 'support_role_id',
    };
    const column = columns[customId];
    if (!column || !value) return;
    if (
      column === 'support_role_id' &&
      (value === guild.id || !interaction.isRoleSelectMenu() || !interaction.roles.has(value))
    ) {
      return interaction.reply(ephemeral('Escolha um cargo específico da equipe de suporte.'));
    }
    if (column !== 'support_role_id') {
      const expected = column === 'category_id' ? ChannelType.GuildCategory : ChannelType.GuildText;
      if (
        !interaction.isChannelSelectMenu() ||
        interaction.channels.get(value)?.type !== expected
      ) {
        return interaction.reply(ephemeral('Escolha um canal do tipo solicitado.'));
      }
    }
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
    const connection = await pool.getConnection();
    const read = async <T extends RowDataPacket[] | ResultSetHeader>(
      sql: string,
      parameters: string[],
    ): Promise<T> => (await connection.execute<T>(sql, parameters))[0];
    const lockOperation = async (sql: string): Promise<boolean> =>
      Number((await read<({ ok: number | null } & RowDataPacket)[]>(sql, [lockName]))[0]?.ok) === 1;
    const outcome = await withTicketLock(
      {
        acquire: () => lockOperation('SELECT GET_LOCK(?, 2) AS ok'),
        unlock: () => lockOperation('SELECT RELEASE_LOCK(?) AS ok'),
        release: () => connection.release(),
        destroy: () => connection.destroy(),
      },
      async () => {
        const config = (await read<ConfigRow[]>(configSql, [guild.id]))[0];
        if (
          config?.panel_message_id !== interaction.message.id ||
          config.panel_channel_id !== interaction.channelId
        ) {
          return 'Este painel foi substituído. Use o painel atual do servidor.';
        }
        if (!config.category_id || !config.support_role_id || config.support_role_id === guild.id) {
          return 'O sistema de tickets ainda não está configurado.';
        }
        const existing = (
          await read<TicketRow[]>(
            `SELECT channel_id FROM tickets
              WHERE guild_id = ? AND user_id = ? AND status = 'open' LIMIT 1`,
            [guild.id, user.id],
          )
        )[0];
        if (existing) {
          try {
            await guild.channels.fetch(existing.channel_id, { force: true });
            return `Você já possui um ticket: <#${existing.channel_id}>`;
          } catch (error) {
            if (
              typeof error !== 'object' ||
              error === null ||
              !('code' in error) ||
              error.code !== RESTJSONErrorCodes.UnknownChannel
            )
              throw error;
            await read(
              "UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND channel_id = ? AND status = 'open'",
              [guild.id, existing.channel_id],
            );
          }
        }
        const createdChannel = await guild.channels.create({
          name: `ticket-${user.username}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .slice(0, 90),
          type: ChannelType.GuildText,
          parent: config.category_id,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
            {
              id: interaction.client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ManageChannels,
              ],
            },
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
        const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Fechar')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('Assumir')
            .setStyle(ButtonStyle.Success),
        );
        try {
          await createdChannel.send({
            allowedMentions: { roles: [config.support_role_id], users: [user.id] },
            content: `<@&${config.support_role_id}> <@${user.id}>`,
            embeds: [
              new EmbedBuilder()
                .setTitle((config.embed_title ?? '') || 'Ticket aberto')
                .setDescription(
                  (config.ticket_message ?? '') || 'Descreva sua solicitação com detalhes.',
                )
                .setColor(
                  config.embed_color && /^#[0-9a-f]{6}$/iu.test(config.embed_color)
                    ? Number.parseInt(config.embed_color.slice(1), 16)
                    : discordTheme.primary,
                ),
            ],
            components: [controls],
          });
          await read('INSERT INTO tickets (guild_id, channel_id, user_id) VALUES (?, ?, ?)', [
            guild.id,
            createdChannel.id,
            user.id,
          ]);
        } catch (error) {
          await createdChannel
            .delete()
            .catch((cleanupError: unknown) =>
              client.services.logger.error(
                'Falha ao remover canal de ticket incompleto.',
                cleanupError,
                { guildId: guild.id, channelId: createdChannel.id },
              ),
            );
          throw error;
        }
        await sendLog(
          guild,
          config.logs_channel_id,
          new EmbedBuilder()
            .setTitle('Ticket aberto')
            .setColor('Green')
            .setDescription(`<@${user.id}> abriu <#${createdChannel.id}>.`)
            .setTimestamp(),
        ).catch((error: unknown) =>
          client.services.logger.error('Falha ao enviar log de ticket.', error, {
            guildId: guild.id,
          }),
        );
        return `Ticket criado: <#${createdChannel.id}>`;
      },
    );
    return interaction.editReply(
      outcome ?? 'A abertura de outro ticket está em andamento. Tente novamente em instantes.',
    );
  }

  if (interaction.isButton() && ['close_ticket', 'claim_ticket'].includes(customId)) {
    const ticket = (
      await query<TicketRow[]>(
        `SELECT user_id, status, claimed_by FROM tickets
            WHERE guild_id = ? AND channel_id = ? LIMIT 1`,
        [guild.id, interaction.channelId],
      )
    )[0];
    if (ticket?.status !== 'open') return interaction.reply(ephemeral('❌ Ticket inválido.'));
    const config = await ticketConfig(guild.id);
    const support =
      (config?.support_role_id != null &&
        config.support_role_id !== guild.id &&
        interaction.member.roles.cache.has(config.support_role_id)) ||
      canConfigure;

    if (customId === 'claim_ticket') {
      if (!support)
        return interaction.reply(ephemeral('❌ Apenas a equipe de suporte pode assumir.'));
      if (!(await claimTicket({ query }, guild.id, interaction.channelId, user.id)))
        return interaction.reply(ephemeral('Este ticket já foi assumido ou encerrado.'));
      const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
      return interaction.followUp(ephemeral(`✅ Ticket assumido por <@${user.id}>.`));
    }

    if (!support && user.id !== ticket.user_id) {
      return interaction.reply(ephemeral('❌ Apenas o autor ou a equipe de suporte pode fechar.'));
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await interaction.editReply('Encerrando o ticket.');
    if (interaction.channel?.type !== ChannelType.GuildText)
      return interaction.editReply('Canal de ticket inválido.');
    await interaction.channel.delete('Solicitação de encerramento do ticket.');
    const closed = await query<ResultSetHeader>(
      `UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP, closed_by = ?
          WHERE guild_id = ? AND channel_id = ? AND status = 'open'`,
      [user.id, guild.id, interaction.channelId],
    );
    if (!closed.affectedRows) return;
    await sendLog(
      guild,
      config?.logs_channel_id,
      new EmbedBuilder()
        .setTitle('Ticket fechado')
        .setColor('Red')
        .setDescription(`<@${ticket.user_id}> · fechado por <@${user.id}>`)
        .setTimestamp(),
    );
    return;
  }

  if (interaction.isButton() && customId === 'config_ticket_appearance') {
    if (!canConfigure) return interaction.reply(ephemeral('❌ Acesso negado.'));
    const modal = new ModalBuilder()
      .setCustomId('modal_ticket_appearance')
      .setTitle('Aparência do ticket');
    const field = (
      id: string,
      label: string,
      length: number,
      style: TextInputStyle,
    ): LabelBuilder =>
      new LabelBuilder()
        .setLabel(label)
        .setTextInputComponent((input) =>
          input.setCustomId(id).setMaxLength(length).setStyle(style).setRequired(false),
        );
    modal.addLabelComponents(
      field('embed_title', 'Título', 255, TextInputStyle.Short),
      field('embed_description', 'Descrição do painel', 2000, TextInputStyle.Paragraph),
      field('embed_color', 'Cor hexadecimal (#5865F2)', 7, TextInputStyle.Short),
      field('ticket_message', 'Mensagem do ticket', 2000, TextInputStyle.Paragraph),
    );
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && customId === 'modal_ticket_appearance') {
    if (!canConfigure) return interaction.reply(ephemeral('❌ Acesso negado.'));
    const color = interaction.fields.getTextInputValue('embed_color').trim() || '#2f3136';
    if (!/^#[0-9a-f]{6}$/i.test(color))
      return interaction.reply(ephemeral('❌ Cor hexadecimal inválida.'));
    await query(
      `INSERT INTO tickets_config (embed_title, embed_description, embed_color, ticket_message, guild_id)
         VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE embed_title = VALUES(embed_title),
           embed_description = VALUES(embed_description), embed_color = VALUES(embed_color), ticket_message = VALUES(ticket_message)`,
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
    if (!canConfigure) return interaction.reply(ephemeral('❌ Acesso negado.'));
    const config = await ticketConfig(guild.id);
    const channel = config?.panel_channel_id
      ? await guild.channels.fetch(config.panel_channel_id).catch(() => undefined)
      : undefined;
    if (!config || channel?.isSendable() !== true)
      return interaction.reply(ephemeral('❌ Canal inválido.'));
    const message = await channel.send(ticketOpeningPanel(config, interaction.guildLocale));
    await query('UPDATE tickets_config SET panel_message_id = ? WHERE guild_id = ?', [
      message.id,
      guild.id,
    ]);
    return interaction.reply(ephemeral('✅ Painel publicado.'));
  }
}
