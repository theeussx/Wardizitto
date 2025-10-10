const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const config = require('../../config.json'); // deve conter o campo canal_bugs

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reportar-bug')
    .setDescription('Reporte um bug diretamente à equipe do bot.')
    .addStringOption(option =>
      option.setName('descricao')
        .setDescription('Explique o bug detalhadamente.')
        .setRequired(true))
    .addAttachmentOption(option =>
      option.setName('imagem')
        .setDescription('Imagem do bug (opcional).')),

  async execute(interaction) {
    const descricao = interaction.options.getString('descricao');
    const imagem = interaction.options.getAttachment('imagem');

    const canalBugId = config.canal_bugs;
    const canal = interaction.client.channels.cache.get(canalBugId);

    if (!canal) {
      return interaction.reply({
        content: '❌ Canal de bugs não está configurado corretamente.',
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🐞 Novo Bug Reportado')
      .addFields(
        { name: '👤 Usuário', value: `${interaction.user.tag} (\`${interaction.user.id}\`)`, inline: false },
        { name: '🌐 Servidor', value: `${interaction.guild?.name || 'DM'} (\`${interaction.guildId || 'DM'}\`)`, inline: false },
        { name: '📝 Descrição', value: descricao, inline: false }
      )
      .setColor('Red')
      .setTimestamp();

    if (imagem) embed.setImage(imagem.url);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirmar_bug_${interaction.id}`)
        .setLabel('✅ Confirmar Bug')
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(`resolver_bug_${interaction.id}`)
        .setLabel('🛠️ Resolver Bug')
        .setStyle(ButtonStyle.Primary)
    );

    await canal.send({
      embeds: [embed],
      components: [row]
    });

    await interaction.reply({
      content: '✅ Seu bug foi enviado com sucesso para a equipe!',
      ephemeral: true
    });
  }
};