const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  name: 'avatar',
  description: 'Mostra o avatar de um usuário.',
  run: async (client, message, args) => {
    const user = message.mentions.users.first() || message.author;
    const avatarURL = user.displayAvatarURL({ dynamic: true, size: 1024 });

    const label = new LabelBuilder()
      .setTitle(`🖼️ Avatar de ${user.username}`)
      .setImage(avatarURL)
      .setColor(Colors.Blurple)
      .setFooter(`Requisitado por ${message.author.username}`)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Link do Avatar').setURL(avatarURL).setStyle(ButtonStyle.Link),
    );

    message.reply({
      components: [label.build(), row],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
