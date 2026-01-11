const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('comunicado')
    .setDescription('「Moderação」Cria um comunicado personalizável com botões para editar e enviar.'),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription('❌ Você precisa da permissão `Gerenciar Mensagens` para usar este comando.')
        ],
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('📢 Título do Comunicado')
      .setDescription('Aqui está o conteúdo do comunicado. Você pode editar antes de enviar.')
      .setColor('#5865F2')
      .setFooter({
        text: `Enviado por ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true })
      })
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
        .setStyle(ButtonStyle.Danger)
    );

    await interaction.deferReply();
    await interaction.editReply({ embeds: [embed], components: [row] });
  }
};