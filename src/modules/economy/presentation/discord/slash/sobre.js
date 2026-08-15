const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sobre')
    .setDescription('Personalize a descrição do seu perfil.')
    .addStringOption((option) =>
      option
        .setName('texto')
        .setDescription('A nova descrição para o seu perfil (máx. 255 caracteres).')
        .setRequired(true)
        .setMaxLength(255),
    ),

  async execute(interaction) {
    const texto = interaction.options.getString('texto');
    const userId = interaction.user.id;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      await query(
        'INSERT INTO economia_usuarios (user_id, sobre_mim) VALUES (?, ?) ON DUPLICATE KEY UPDATE sobre_mim = ?',
        [userId, texto, texto],
      );

      const label = new LabelBuilder()
        .setTitle('✅ Perfil Atualizado')
        .setDescription(`Sua nova descrição foi definida para:\n\n*${texto}*`)
        .setColor(Colors.Green)
        .setTimestamp();

      await interaction.editReply({
        components: [label.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      interaction.client.services.logger.error('Erro ao atualizar sobre_mim:', error);
      await interaction.editReply('❌ Ocorreu um erro ao atualizar sua descrição.');
    }
  },
};
