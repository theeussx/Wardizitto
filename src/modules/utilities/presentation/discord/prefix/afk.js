module.exports = {
  name: 'afk',
  description: 'Defina seu status como AFK.',
  async execute(message, args) {
    const reason = (args.join(' ').trim() || 'Estou AFK!').slice(0, 500);
    await message.client.services.afk.set(message.guildId, message.author.id, reason);
    await message.reply(`💤 Status AFK ativado: ${reason}`);
  },
};
