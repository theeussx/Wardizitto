const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'userinfo',
  description: 'Mostra informações detalhadas de um usuário.',
  run: async (client, message, args) => {
    const target = message.mentions.members.first() || message.member;
    const user = target.user;

    const embed = new EmbedBuilder()
      .setAuthor({ name: `Informações de ${user.username}`, iconURL: user.displayAvatarURL() })
      .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
      .setColor(target.displayHexColor || '#5865F2')
      .addFields(
        { name: '👤 Tag', value: `\`${user.tag}\``, inline: true },
        { name: '🆔 ID', value: `\`${user.id}\``, inline: true },
        {
          name: '📅 Conta Criada',
          value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: '📥 Entrou no Servidor',
          value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`,
          inline: true,
        },
        {
          name: '🎭 Cargos',
          value:
            target.roles.cache
              .filter((r) => r.id !== message.guild.id)
              .map((r) => r)
              .join(' ') || 'Nenhum',
          inline: false,
        },
      )
      .setFooter({ text: `Requisitado por ${message.author.username}` })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },
};
