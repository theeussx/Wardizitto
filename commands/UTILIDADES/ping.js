const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('「Utilidades」Veja o ping do bot.'),
  async execute(interaction) {
    const { client } = interaction;
    const ping = client.ws.ping;
    const pingEmoji = '<:icons_ping:1353597341864689714>';

    // Embed inicial informando que o ping está sendo calculado
    const embedCalculando = new EmbedBuilder()
      .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL({ dynamic: true }) })
      .setDescription(`Olá ${interaction.user}, ${pingEmoji} meu ping está em \`calculando...\`.`)
      .setColor('Random');

    // Embed final com o valor do ping
    const embedFinal = new EmbedBuilder()
      .setAuthor({ name: client.user.username, iconURL: client.user.displayAvatarURL({ dynamic: true }) })
      .setDescription(`Olá ${interaction.user}, ${pingEmoji} meu ping está em \`${ping}ms\`.`)
      .setColor('Random');

    // Responde ao comando com o embed de cálculo
    await interaction.reply({ embeds: [embedCalculando] });

    // Simula tempo de "cálculo" antes de atualizar a resposta
    setTimeout(async () => {
      await interaction.editReply({ embeds: [embedFinal] });
    }, 2000);
  },
};