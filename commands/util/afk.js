const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { pool } = require('../../handlers/db.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('「Utilidades」Defina seu status como AFK.')
    .addStringOption(option =>
      option.setName('mensagem')
        .setDescription('Mensagem personalizada para seu status AFK.')
        .setRequired(false)
    ),
  
  async execute(interaction) {
    const mensagem = interaction.options.getString('mensagem') || 'Estou AFK!';

    try {
      // Verifica se usuário já está AFK
      const [rows] = await pool.query('SELECT * FROM afk_status WHERE user_id = ?', [interaction.user.id]);
      
      if (rows.length > 0) {
        return interaction.reply({ content: 'Você já está AFK!', ephemeral: true });
      }
      
      // Salva status AFK
      await pool.query(
        'INSERT INTO afk_status (user_id, mensagem, timestamp) VALUES (?, ?, ?)',
        [interaction.user.id, mensagem, Date.now()]
      );

      const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('<:eg_notification:1353597146984878081> Modo AFK Ativado')
        .setDescription(`Você agora está AFK!\n<:eg_message:1353597140055756800> **Mensagem:** ${mensagem}`)
        .setFooter({ text: 'Mencione o usuário para ver seu status AFK.' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
      console.error('Erro no comando AFK:', error);
      await interaction.reply({ content: 'Ocorreu um erro ao ativar AFK.', ephemeral: true });
    }
  },
};