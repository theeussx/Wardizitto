const { MessageFlags } = require('discord.js');
const { pool } = require('../../../../../infrastructure/database/legacy.js');

module.exports = {
  async execute(interaction) {
    if (
      !interaction.isButton() ||
      !['verify_button', 'verificar_button'].includes(interaction.customId)
    ) {
      return;
    }
    if (!interaction.inGuild() || !interaction.member?.roles?.cache) {
      return interaction.reply({
        content: '❌ A verificação só está disponível no servidor.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const configuredRoleId = interaction.client.services.config.VERIFICATION_ROLE_ID;
    const role = configuredRoleId
      ? interaction.guild.roles.cache.get(configuredRoleId)
      : interaction.guild.roles.cache.find((candidate) => candidate.name === 'Verificado');
    if (!role) {
      return interaction.reply({
        content: '❌ O cargo de verificação não foi configurado.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (interaction.member.roles.cache.has(role.id)) {
      return interaction.reply({
        content: '✅ Você já está verificado.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.member.roles.add(role);
    try {
      await pool.execute(
        `INSERT INTO verified_users (user_id, guild_id, verificado, verified_at)
         VALUES (?, ?, TRUE, CURRENT_TIMESTAMP)
         ON DUPLICATE KEY UPDATE verificado = TRUE, verified_at = CURRENT_TIMESTAMP`,
        [interaction.user.id, interaction.guildId],
      );
    } catch (error) {
      await interaction.member.roles.remove(role).catch(() => undefined);
      throw error;
    }
    return interaction.reply({
      content: `✅ Verificação concluída; você recebeu o cargo **${role.name}**.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
