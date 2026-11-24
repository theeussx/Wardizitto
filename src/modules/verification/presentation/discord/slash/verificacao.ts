import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits as P,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';

import { discordTheme } from '../../../../../core/design/discord-theme.js';
import { verificationCopy } from '../../../copy.js';
import { query } from '../../../../../infrastructure/database/legacy.js';
import { eligibleRole } from '../../../verification-settings.js';

export const data = new SlashCommandBuilder()
  .setName('verificacao')
  .setNameLocalization('en-US', 'verification')
  .setDescription('Publica o painel de verificação neste canal.')
  .setDescriptionLocalization('en-US', 'Publish a verification panel in this channel.')
  .setDefaultMemberPermissions(P.ManageGuild | P.ManageRoles)
  .addRoleOption((o) =>
    o
      .setName('cargo')
      .setNameLocalization('en-US', 'role')
      .setDescription('Cargo de participante concedido após a verificação.')
      .setDescriptionLocalization('en-US', 'Participant role to grant after verification.')
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const copy = verificationCopy(interaction.locale);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (
    !interaction.inCachedGuild() ||
    !interaction.channel?.isSendable() ||
    !interaction.member.permissions.has([P.ManageGuild, P.ManageRoles])
  ) {
    await interaction.editReply(copy.denied);
    return;
  }
  const role = await eligibleRole(interaction.guild, interaction.options.getRole('cargo', true).id);
  if (
    !role ||
    (interaction.guild.ownerId !== interaction.user.id &&
      interaction.member.roles.highest.comparePositionTo(role) <= 0)
  ) {
    await interaction.editReply(copy.role);
    return;
  }
  const publicCopy = verificationCopy(interaction.guildLocale);
  const panel = new ContainerBuilder()
    .setAccentColor(discordTheme.primary)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `## ${publicCopy.title}\n${publicCopy.description} <@&${role.id}>.`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('verify:v1')
          .setLabel(publicCopy.button)
          .setStyle(ButtonStyle.Primary),
      ),
    );
  const message = await interaction.channel.send({
    components: [panel],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  });
  await query(
    'INSERT INTO verification_panels (guild_id, role_id, message_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role_id = VALUES(role_id), message_id = VALUES(message_id)',
    [interaction.guildId, role.id, message.id],
  );
  await interaction.editReply(copy.published);
}
