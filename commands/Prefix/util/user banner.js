module.exports = {
  name: 'user-banner',
  description: 'Mostra o banner de um usuário.',
  usage: '[usuario]',
  async execute(message, args) {
    const user = message.mentions.users.first() || message.author;
    const member = await message.client.users.fetch(user.id, { force: true });
    const bannerURL = member.bannerURL({ dynamic: true, size: 512 });

    if (!bannerURL) {
      return message.reply(`O usuário **${user.tag}** não possui um banner.`);
    }

    // ...existing code...
  }
};