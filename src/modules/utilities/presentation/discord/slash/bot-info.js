const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const os = require('node:os');

const formatUptime = (milliseconds) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  return `${days}d ${hours}h ${minutes}m`;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot')
    .setDescription('Comandos relacionados ao bot.')
    .addSubcommand((subcommand) =>
      subcommand.setName('info').setDescription('Exibe informações do Wardizitto.'),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const memory = process.memoryUsage();
    const totalUsers = client.guilds.cache.reduce((total, guild) => total + guild.memberCount, 0);
    const embed = new EmbedBuilder()
      .setColor('#5865f2')
      .setTitle('Wardizitto v2')
      .setThumbnail(client.user.displayAvatarURL())
      .addFields(
        { name: 'Versão', value: '2.0.0', inline: true },
        { name: 'Node.js', value: process.version, inline: true },
        { name: 'Ping', value: `${client.ws.ping} ms`, inline: true },
        {
          name: 'Servidores',
          value: client.guilds.cache.size.toLocaleString('pt-BR'),
          inline: true,
        },
        { name: 'Usuários', value: totalUsers.toLocaleString('pt-BR'), inline: true },
        { name: 'Uptime', value: formatUptime(client.uptime ?? 0), inline: true },
        {
          name: 'Heap usado',
          value: `${(memory.heapUsed / 1024 / 1024).toFixed(1)} MB`,
          inline: true,
        },
        { name: 'Plataforma', value: `${os.platform()} ${os.arch()}`, inline: true },
        {
          name: 'Owners',
          value: client.services.config.DISCORD_OWNER_IDS.map((id) => `<@${id}>`).join(', '),
          inline: true,
        },
      )
      .setFooter({ text: 'Arquitetura modular · AGPL-3.0' })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  },
};
