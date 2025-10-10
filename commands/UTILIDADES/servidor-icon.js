const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servidor-icone')
    .setDescription('「Utilidades」Mostra o ícone do servidor.')
    .addStringOption(option =>
      option.setName('servidor_id')
        .setDescription('ID do servidor (opcional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const servidorId = interaction.options.getString('servidor_id');
    let guild;

    if (servidorId) {
      guild = interaction.client.guilds.cache.get(servidorId);
      if (!guild) {
        return interaction.reply({
          content: `**Não encontrei esse servidor.**\nVerifique se o ID está correto ou se o bot está presente nele.`,
          ephemeral: true
        });
      }
    } else {
      guild = interaction.guild;
    }

    const serverIcon = guild.iconURL({ dynamic: true, size: 1024 });

    if (!serverIcon) {
      return interaction.reply({
        content: 'Este servidor **não possui um ícone definido.**',
        ephemeral: true
      });
    }

    const globeEmoji = '<:eg_globe:1353597122204667904>';
    const imageEmoji = '<:icons_image:1353597443513516053>';
    const idEmoji = '<:icons_id:1353597440556662795>';

    const embed = new EmbedBuilder()
      .setTitle(`${globeEmoji} Ícone do Servidor: ${guild.name}`)
      .setDescription(`${imageEmoji} Clique [aqui](${serverIcon}) para abrir em tamanho completo.\n${idEmoji} ID do Servidor: \`${guild.id}\``)
      .setImage(serverIcon)
      .setColor('Blue')
      .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};