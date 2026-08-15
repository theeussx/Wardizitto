const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('casamento')
    .setDescription('Veja com quem você está casado neste servidor.'),

  async execute(interaction) {
    const marriage = await interaction.client.services.marriages.find(
      interaction.guildId,
      interaction.user.id,
    );
    if (!marriage) {
      return interaction.reply({
        content: 'Você não está casado neste servidor.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const partner = await interaction.client.users.fetch(marriage.partnerId);
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('💜 Casamento')
          .setDescription(`Você está casado com **${partner.tag}**.`)
          .setColor('Purple')
          .setFooter({ text: `Desde ${new Date(marriage.createdAt).toLocaleDateString('pt-BR')}` }),
      ],
    });
  },
};
