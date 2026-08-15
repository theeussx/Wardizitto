const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const {
  LabelBuilder,
  Colors,
  emoji,
} = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('「Moderação」Destrava o canal, permitindo que os membros enviem mensagens.'),

  async execute(interaction) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: `${emoji('eg_unlock')} Você não tem permissão para usar este comando.`,
        ephemeral: true,
      });
    }

    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null,
      });

      const label = new LabelBuilder()
        .setColor(Colors.Green)
        .setTitle(`${emoji('eg_unlock')} Canal Destravado`)
        .setDescription(
          'Este canal foi **destravado** e os membros agora podem enviar mensagens novamente.',
        )
        .setFooter('Moderação')
        .setTimestamp();

      await interaction.reply({
        components: [label.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (error) {
      interaction.client.services.logger.error('Erro em handler de compatibilidade.', error);
      return interaction.reply({
        content: '❌ Ocorreu um erro ao tentar destravar o canal.',
        ephemeral: true,
      });
    }
  },
};
