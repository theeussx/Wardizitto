const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user-banner')
    .setDescription('「Utilidades」Mostra o banner de um usuário.')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Selecione o usuário.')
        .setRequired(false)
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('usuario') || interaction.user;
    const member = await interaction.client.users.fetch(user.id, { force: true });
    const bannerURL = member.bannerURL({ dynamic: true, size: 512 });

    if (!bannerURL) {
      return interaction.reply({
        content: `O usuário **${user.tag}** não possui um banner.`,
        ephemeral: true,
      });
    }

    return interaction.reply({
      embeds: [
        {
          color: 0x0099ff,
          title: `<:eg_art:1353597094535106600> Banner de ${user.tag}`,
          image: { url: bannerURL },
          description: `[Clique aqui para baixar](${bannerURL})`,
        },
      ],
    });
  },
};