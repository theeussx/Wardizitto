const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('「Moderação」Trava o canal, impedindo que os membros enviem mensagens.'),
  
  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: `<:eg_lock:1353597133806243873> Você não tem permissão para usar este comando.`,
        ephemeral: true,
      });
    }

    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false,
      });

      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('<:eg_lock:1353597133806243873> Canal Travado')
        .setDescription('Este canal foi **travado** e os membros não podem mais enviar mensagens.')
        .setFooter({ text: 'Moderação', iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      return interaction.reply({
        content: '❌ Ocorreu um erro ao tentar travar o canal.',
        ephemeral: true,
      });
    }
  },
};