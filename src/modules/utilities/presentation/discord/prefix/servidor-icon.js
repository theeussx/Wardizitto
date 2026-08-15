const { MessageFlags } = require('discord.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  name: 'servidor-icone',
  description: 'Mostra o ícone do servidor atual.',
  async execute(message) {
    const icon = message.guild.iconURL({ extension: 'png', size: 1024 });
    if (!icon) return message.reply('Este servidor não possui ícone.');

    const label = new LabelBuilder()
      .setColor(Colors.Blurple)
      .setTitle(`Ícone de ${message.guild.name}`)
      .setImage(icon);

    return message.reply({
      components: [label.build()],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
