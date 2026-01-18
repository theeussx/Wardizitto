const { MessageEmbed } = require('discord.js');
const { pool } = require('../../../handlers/db.js');

module.exports = {
  name: 'afk',
  description: 'Defina seu status como AFK.',
  usage: '[mensagem]',
  async execute(message, args) {
    const mensagem = args.join(' ') || 'Estou AFK!';

    try {
      // Verifica se usuário já está AFK
      const [rows] = await pool.query('SELECT * FROM afk_status WHERE user_id = ?', [message.author.id]);
      
      // ...existing code...
    } catch (error) {
      console.error(error);
      message.reply('Ocorreu um erro ao definir seu status AFK.');
    }
  }
};