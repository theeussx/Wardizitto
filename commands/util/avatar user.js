const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Exibe o avatar de um usuário.')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('「Utilidades」Selecione o usuário desejado.')
        .setRequired(false)
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('usuario') || interaction.user;
    const avatarURL = user.displayAvatarURL({ dynamic: true, size: 1024 });
    const emoji = '<:eg_image:1353597443513516053>';

    const embed = {
      author: {
        name: interaction.client.user.username,
        icon_url: interaction.client.user.displayAvatarURL({ dynamic: true })
      },
      color: 0x2f3136,
      title: `${emoji} Avatar de ${user.tag}`,
      image: { url: avatarURL },
      description: `[Clique aqui para baixar](${avatarURL})`,
      timestamp: new Date(),
      footer: {
        text: 'MightWard',
        icon_url: interaction.client.user.displayAvatarURL({ dynamic: true })
      }
    };

    return interaction.reply({ embeds: [embed] });
  },
};