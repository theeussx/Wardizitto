const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const {
  LabelBuilder,
  Colors,
  emoji,
} = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('「Moderação」Trava o canal, impedindo que os membros enviem mensagens.'),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: `${emoji('eg_lock')} Você não tem permissão para usar este comando.`,
        ephemeral: true,
      });
    }

    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false,
      });

      const label = new LabelBuilder()
        .setColor(Colors.Red)
        .setTitle(`${emoji('eg_lock')} Canal Travado`)
        .setDescription('Este canal foi **travado** e os membros não podem mais enviar mensagens.')
        .setFooter('Moderação')
        .setTimestamp();

      await interaction.reply({
        components: [label.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      interaction.client.services.logger.error('Erro em handler de compatibilidade.', error);
      return interaction.reply({
        content: '❌ Ocorreu um erro ao tentar travar o canal.',
        ephemeral: true,
      });
    }
  },
};
