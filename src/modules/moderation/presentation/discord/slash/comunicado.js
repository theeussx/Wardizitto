const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  MessageFlags,
} = require('discord.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('comunicado')
    .setDescription(
      '「Moderação」Cria um comunicado personalizável com botões para editar e enviar.',
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      const denyLabel = new LabelBuilder()
        .setColor(Colors.Red)
        .setDescription(
          '❌ Você precisa da permissão `Gerenciar Mensagens` para usar este comando.',
        );
      return interaction.reply({
        components: [denyLabel.build()],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const label = new LabelBuilder()
      .setTitle('📢 Título do Comunicado')
      .setDescription('Aqui está o conteúdo do comunicado. Você pode editar antes de enviar.')
      .setColor('#5865F2')
      .setFooter(`Enviado por ${interaction.user.tag}`)
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('editar_comunicado')
        .setLabel('✏️ Editar Embed')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('enviar_comunicado')
        .setLabel('📤 Enviar')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId('cancelar_comunicado')
        .setLabel('❌ Cancelar')
        .setStyle(ButtonStyle.Danger),
    );

    await interaction.deferReply();
    await interaction.editReply({
      components: [label.build(), row],
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
