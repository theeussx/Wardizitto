const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user-info')
    .setDescription('「Utilidades」Veja as informações de um usuário.')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('Selecione um usuário para ver as informações.')
        .setRequired(false)
    ),
  async execute(interaction) {
    const user = interaction.options.getUser('user') || interaction.user; // Se não escolher, pega o autor da interação
    const member = await interaction.guild.members.fetch(user.id); // Pega o membro do servidor

    // Pega o cargo mais alto do usuário
    const highestRole = member.roles.cache
      .filter(role => role.name !== '@everyone') // Remove o @everyone
      .sort((a, b) => b.position - a.position) // Ordena por posição
      .first(); // Pega o cargo mais alto

    // Se não houver cargo, mostrar "Nenhum"
    const highestRoleName = highestRole ? highestRole.name : 'Nenhum cargo';

    // Calcular datas com formatação em pt-BR
    const joinDate = member.joinedAt.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const accountDate = user.createdAt.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Emojis personalizados
    const userEmoji = '<:eg_member:1353597138411585628>';
    const idEmoji = '<:icons_id:1353597440556662795>';
    const calendarEmoji = '<:icons_calendar1:1353597221332975657>';
    const roleEmoji = '<:icons_list:1353597446369841184>';

    // Criando o embed
    const embed = new EmbedBuilder()
      .setTitle(`${userEmoji} Informações de ${user.tag}`)
      .setColor('#3498db')
      .setThumbnail(user.displayAvatarURL({ size: 1024 }))
      .addFields(
        { name: `${idEmoji} ID do usuário`, value: user.id, inline: true },
        { name: `${calendarEmoji} Entrou no servidor em`, value: joinDate, inline: true },
        { name: `${calendarEmoji} Criou a conta em`, value: accountDate, inline: true },
        { name: `${roleEmoji} Cargo mais alto`, value: highestRoleName, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `Solicitado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

    // Envia a embed com as informações do usuário
    await interaction.reply({ embeds: [embed] });
  },
};