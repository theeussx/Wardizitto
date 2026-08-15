const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'servidor-icone',
  description: 'Mostra o ícone do servidor atual.',
  async execute(message) {
    const icon = message.guild.iconURL({ extension: 'png', size: 1024 });
    if (!icon) return message.reply('Este servidor não possui ícone.');
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#5865f2')
          .setTitle(`Ícone de ${message.guild.name}`)
          .setImage(icon),
      ],
    });
  },
};
