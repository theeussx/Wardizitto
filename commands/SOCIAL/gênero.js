const { SlashCommandBuilder } = require('discord.js');
const pool = require('../../handlers/db.js'); // sua conexão com MariaDB

module.exports = {
  data: new SlashCommandBuilder()
    .setName('genero')
    .setDescription('Defina seu gênero para os comandos sociais.')
    .addStringOption(option =>
      option.setName('tipo')
        .setDescription('Escolha seu gênero')
        .setRequired(true)
        .addChoices(
          { name: 'Masculino', value: 'masculino' },
          { name: 'Feminino', value: 'feminino' }
        )
    ),

  async execute(interaction) {
    const genero = interaction.options.getString('tipo');
    const userId = interaction.user.id;

    try {
      await pool.query(
        'INSERT INTO generos (user_id, genero) VALUES (?, ?) ON DUPLICATE KEY UPDATE genero = VALUES(genero)',
        [userId, genero]
      );

      await interaction.reply({
        content: `✅ Gênero definido como \`${genero}\` com sucesso.`,
        ephemeral: true,
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: '❌ Erro ao salvar seu gênero no sistema.',
        ephemeral: true,
      });
    }
  },
};