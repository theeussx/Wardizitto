const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ajuda',
  description: 'Lista os comandos disponíveis.',
  async execute(message) {
    const slashByCategory = new Map();
    for (const command of message.client.commands.values()) {
      const commands = slashByCategory.get(command.category) || [];
      commands.push(`/${command.data.name}`);
      slashByCategory.set(command.category, commands);
    }
    const prefixByCategory = new Map();
    for (const command of message.client.prefixCommands.values()) {
      const commands = prefixByCategory.get(command.category) || [];
      commands.push(`${message.client.services.config.DISCORD_PREFIX}${command.name}`);
      prefixByCategory.set(command.category, commands);
    }
    const fields = [...new Set([...slashByCategory.keys(), ...prefixByCategory.keys()])]
      .sort()
      .map((category) => ({
        name: category,
        value: [...(slashByCategory.get(category) || []), ...(prefixByCategory.get(category) || [])]
          .sort()
          .join(', ')
          .slice(0, 1024),
      }))
      .slice(0, 25);
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#5865f2')
          .setTitle('Comandos do Wardizitto')
          .addFields(fields)
          .setFooter({ text: 'Prefira os comandos de barra para uma experiência completa.' }),
      ],
    });
  },
};
