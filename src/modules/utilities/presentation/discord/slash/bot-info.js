const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const os = require('node:os');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

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
    const label = new LabelBuilder()
      .setColor(Colors.Blurple)
      .setTitle('Wardizitto v2')
      .setThumbnail(client.user.displayAvatarURL())
      .addField('Versão', '2.0.0', true)
      .addField('Node.js', process.version, true)
      .addField('Ping', `${client.ws.ping} ms`, true)
      .addField('Servidores', client.guilds.cache.size.toLocaleString('pt-BR'), true)
      .addField('Usuários', totalUsers.toLocaleString('pt-BR'), true)
      .addField('Uptime', formatUptime(client.uptime ?? 0), true)
      .addField('Heap usado', `${(memory.heapUsed / 1024 / 1024).toFixed(1)} MB`, true)
      .addField('Plataforma', `${os.platform()} ${os.arch()}`, true)
      .addField(
        'Owners',
        client.services.config.DISCORD_OWNER_IDS.map((id) => `<@${id}>`).join(', '),
        true,
      )
      .setFooter('Arquitetura modular · AGPL-3.0')
      .setTimestamp();
    await interaction.reply({
      components: [label.build()],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
