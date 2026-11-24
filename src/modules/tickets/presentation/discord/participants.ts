import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { RowDataPacket } from 'mysql2/promise';

import { query } from '../../../../infrastructure/database/legacy.js';

interface TicketStaffRow extends RowDataPacket {
  user_id: string;
  support_role_id: string | null;
}

export async function editParticipant(
  interaction: ChatInputCommandInteraction,
  add: boolean,
): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!interaction.inCachedGuild() || interaction.channel?.type !== ChannelType.GuildText) {
    await interaction.editReply('Este comando exige um canal de ticket ativo.');
    return;
  }
  const [ticket] = await query<TicketStaffRow[]>(
    `SELECT t.user_id, c.support_role_id FROM tickets t LEFT JOIN tickets_config c ON c.guild_id = t.guild_id
     WHERE t.guild_id = ? AND t.channel_id = ? AND t.status = 'open'`,
    [interaction.guildId, interaction.channelId],
  );
  if (!ticket) {
    await interaction.editReply('Este canal não corresponde a um ticket ativo.');
    return;
  }
  if (
    !interaction.memberPermissions.has(PermissionFlagsBits.Administrator) &&
    !(
      ticket.support_role_id &&
      ticket.support_role_id !== interaction.guildId &&
      interaction.member.roles.cache.has(ticket.support_role_id)
    )
  ) {
    await interaction.editReply('Somente a equipe de suporte pode editar os participantes.');
    return;
  }
  const user = interaction.options.getUser('usuario', true);
  if (user.id === ticket.user_id || user.id === interaction.client.user.id) {
    await interaction.editReply('O autor e o bot têm acesso obrigatório ao ticket.');
    return;
  }
  if (add) {
    const member = await interaction.guild.members.fetch(user.id);
    await interaction.channel.permissionOverwrites.edit(member, {
      ViewChannel: true,
      SendMessages: true,
      AttachFiles: true,
    });
  } else {
    await interaction.channel.permissionOverwrites.delete(user);
  }
  await interaction.editReply({
    content: add
      ? `<@${user.id}> recebeu acesso ao ticket.`
      : `A permissão individual de <@${user.id}> foi removida.`,
    allowedMentions: { parse: [] },
  });
}
