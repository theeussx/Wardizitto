const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder
} = require('discord.js');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('enviar-fanart')
    .setDescription('Envie sua fanart para a equipe revisar.')
    .addStringOption(option =>
      option.setName('descricao')
        .setDescription('Descrição da sua fanart.')
        .setRequired(true))
    .addAttachmentOption(option =>
      option.setName('imagem')
        .setDescription('Imagem da fanart.')
        .setRequired(true)),

  async execute(interaction) {
    const descricao = interaction.options.getString('descricao');
    const imagem = interaction.options.getAttachment('imagem');
    const canalId = config.canal_fanarts_revisao;
    const canal = interaction.client.channels.cache.get(canalId);

    if (!canal) {
      return interaction.reply({
        content: '❌ Canal de revisão não encontrado.',
        ephemeral: true
      });
    }

    const response = await fetch(imagem.url);
    const buffer = await response.arrayBuffer();
    const attachment = new AttachmentBuilder(Buffer.from(buffer), { name: 'fanart.png' });

    const embed = new EmbedBuilder()
      .setTitle('🎨 Nova Fanart Enviada')
      .setDescription(`**Descrição:** ${descricao}`)
      .setImage('attachment://fanart.png')
      .addFields([
        { name: '👤 Usuário', value: `${interaction.user.tag}` }
      ])
      .setColor('Purple')
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`aprovar_fanart_${interaction.user.id}`)
        .setLabel('✅ Aprovar fanart')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`rejeitar_fanart_${interaction.user.id}`)
        .setLabel('❌ Rejeitar fanart')
        .setStyle(ButtonStyle.Danger)
    );

    await canal.send({ embeds: [embed], files: [attachment], components: [row] });

    await interaction.reply({
      content: '✅ Sua fanart foi enviada para revisão!',
      ephemeral: true
    });
  }
};