import { MessageFlags, type Interaction } from 'discord.js';

import { verificationCopy } from '../../../copy.js';
import { query } from '../../../../../infrastructure/database/legacy.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';
import {
  eligibleRole,
  readPanel,
  resolveVerificationRole,
} from '../../../verification-settings.js';

export async function execute(interaction: Interaction, client: WardizittoClient): Promise<void> {
  if (
    !interaction.isButton() ||
    !['verify:v1', 'verify_button', 'verificar_button'].includes(interaction.customId)
  )
    return;
  const copy = verificationCopy(interaction.locale);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!interaction.inCachedGuild() || !interaction.guild.available) {
    await interaction.editReply(copy.guild);
    return;
  }
  if (interaction.member.pending) {
    await interaction.editReply(copy.screening);
    return;
  }
  const panel = await readPanel(interaction.guildId);
  const roleId = resolveVerificationRole(
    panel,
    interaction.message.id,
    interaction.customId,
    client.services.config.VERIFICATION_ROLE_ID,
  );
  if (roleId === null) {
    await interaction.editReply(copy.stale);
    return;
  }
  const role = roleId && (await eligibleRole(interaction.guild, roleId));
  if (!role) {
    await interaction.editReply(copy.missing);
    return;
  }
  // Adding a single role is idempotent. Repeating the action also repairs a previous DB failure.
  await interaction.member.roles.add(role, 'Verificação solicitada pelo membro.');
  await query(
    `INSERT INTO verified_users (user_id, guild_id, verificado, verified_at)
     VALUES (?, ?, TRUE, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE verificado = TRUE`,
    [interaction.user.id, interaction.guildId],
  );
  await interaction.editReply({
    content: `${copy.verified} <@&${role.id}>.`,
    allowedMentions: { parse: [] },
  });
}
