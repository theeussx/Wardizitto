const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'user-banner',
  description: 'Mostra o banner de um usuário.',
  async execute(message) {
    const selected = message.mentions.users.first() || message.author;
    const user = await message.client.users.fetch(selected.id, { force: true });
    const banner = user.bannerURL({ extension: 'png', size: 1024 });
    if (!banner) return message.reply(`O usuário **${user.tag}** não possui banner.`);
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(user.accentColor ?? '#5865f2')
          .setTitle(`Banner de ${user.username}`)
          .setImage(banner),
      ],
    });
  },
};
