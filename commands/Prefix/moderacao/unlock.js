const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('「Moderação」Destrava o canal, permitindo que os membros enviem mensagens.'),
  
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: `<:eg_unlock:1353597171462836225> Você não tem permissão para usar este comando.`,
        ephemeral: true,
      });
    }

    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null,
      });

      const embed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('<:eg_unlock:1353597171462836225> Canal Destravado')
        .setDescription('Este canal foi **destravado** e os membros agora podem enviar mensagens novamente.')
        .setFooter({ text: 'Moderação', iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return interaction.reply({
        content: '❌ Ocorreu um erro ao tentar destravar o canal.',
        ephemeral: true,
      });
    }
  },
};