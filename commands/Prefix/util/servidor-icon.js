const { MessageEmbed } = require('discord.js');

module.exports = {
  name: 'servidor-icone',
  description: 'Mostra o ícone do servidor.',
  usage: '[servidor_id]',
  async execute(message, args) {
    const servidorId = args[0];
    let guild;

    if (servidorId) {
      guild = message.client.guilds.cache.get(servidorId);
      if (!guild) {
        return message.reply('Servidor não encontrado.');
      }
    } else {
      guild = message.guild;
    }

    // ...existing code...
  }
};