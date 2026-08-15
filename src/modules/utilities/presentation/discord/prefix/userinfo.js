const { MessageFlags } = require('discord.js');
const { LabelBuilder } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  name: 'userinfo',
  description: 'Mostra informações detalhadas de um usuário.',
  run: async (client, message, args) => {
    const target = message.mentions.members.first() || message.member;
    const user = target.user;

    const label = new LabelBuilder()
      .setAuthor(`Informações de ${user.username}`, user.displayAvatarURL())
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setColor(target.displayHexColor || '#5865F2')
      .addField('👤 Tag', `\`${user.tag}\``, true)
      .addField('🆔 ID', `\`${user.id}\``, true)
      .addField('📅 Conta Criada', `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, true)
      .addField('📥 Entrou no Servidor', `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, true)
      .addField(
        '🎭 Cargos',
        target.roles.cache
          .filter((r) => r.id !== message.guild.id)
          .map((r) => r)
          .join(' ') || 'Nenhum',
      )
      .setFooter(`Requisitado por ${message.author.username}`)
      .setTimestamp();

    message.reply({
      components: [label.build()],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
