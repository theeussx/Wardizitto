const { MessageFlags } = require('discord.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  name: 'serverinfo',
  description: 'Mostra informações detalhadas do servidor.',
  run: async (client, message, args) => {
    const guild = message.guild;
    const owner = await guild.fetchOwner();

    const label = new LabelBuilder()
      .setTitle(`🏰 Informações do Servidor: ${guild.name}`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
      .setColor(Colors.Blurple)
      .addField('👑 Dono', `${owner.user.tag}`, true)
      .addField('🆔 ID', `\`${guild.id}\``, true)
      .addField('📅 Criado em', `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, true)
      .addField('👥 Membros', `\`${guild.memberCount}\` membros`, true)
      .addField('💬 Canais', `\`${guild.channels.cache.size}\` canais`, true)
      .addField('🎭 Cargos', `\`${guild.roles.cache.size}\` cargos`, true)
      .addField(
        '🚀 Boosts',
        `Nível \`${guild.premiumTier}\` (${guild.premiumSubscriptionCount} boosts)`,
        true,
      )
      .setFooter(`Requisitado por ${message.author.username}`)
      .setTimestamp();

    message.reply({
      components: [label.build()],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
