const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

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

    const label = new LabelBuilder()
      .setTitle('💜 Casamento')
      .setDescription(`Você está casado com **${partner.tag}**.`)
      .setColor(Colors.Purple)
      .setFooter(`Desde ${new Date(marriage.createdAt).toLocaleDateString('pt-BR')}`);

    return interaction.reply({
      components: [label.build()],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
