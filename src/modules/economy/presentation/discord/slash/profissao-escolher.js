const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
  AttachmentBuilder,
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const db = require('../../../../../infrastructure/database/legacy.js');
const {
  LabelBuilder,
  Colors,
  emoji,
  emojiURL,
} = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('escolher-profissao')
    .setDescription('Escolha sua profissão para ganhar Wardcoins!'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // Mensagem de loading (efêmera)
    await interaction.reply({
      content: `${emoji('loading', true)} Carregando menu de profissões...`,
      flags: MessageFlags.Ephemeral,
    });

    try {
      // Criar banner
      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');

      // Fundo
      ctx.fillStyle = '#00BFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Carregar avatar
      const avatar = await loadImage(
        interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
      );
      ctx.save();
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true); // Círculo para avatar (80x80)
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 20, 20, 80, 80); // Desenha avatar
      ctx.restore();

      // Adicionar borda ao avatar
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true);
      ctx.stroke();

      // Texto
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Arial';
      ctx.fillText('Escolha sua Profissão', 120, 50);
      ctx.font = '20px Arial';
      ctx.fillText('Selecione no menu abaixo', 120, 90);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'profissao-banner.png' });

      // Criar menu
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('selecionar_profissao')
          .setPlaceholder('Selecione sua profissão')
          .addOptions([
            { label: 'Programador', value: 'Programador', description: 'Cria códigos incríveis!' },
            { label: 'Mecânico', value: 'Mecânico', description: 'Conserta tudo com maestria!' },
            { label: 'Designer', value: 'Designer', description: 'Transforma ideias em arte!' },
            { label: 'Streamer', value: 'Streamer', description: 'Entretenimento ao vivo!' },
            { label: 'Músico', value: 'Músico', description: 'Encanta com melodias!' },
          ]),
      );

      // Criar rótulo
      const label = new LabelBuilder()
        .setTitle(`${emoji('eg_tools')} Escolher Profissão`)
        .setDescription('Selecione uma profissão para começar a ganhar Wardcoins!')
        .setColor('#00BFFF')
        .addField(
          `${emoji('icons_star')} Instruções`,
          'Use o menu abaixo para escolher sua profissão.',
        )
        .setImage('attachment://profissao-banner.png')
        .setFooter('Sistema de economia Wardcoins', emojiURL('icons_logo', true))
        .setTimestamp();

      await interaction.editReply({
        content: null,
        components: [label.build(), row],
        files: [attachment],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      interaction.client.services.logger.error(
        'Erro ao executar o comando /escolher-profissao:',
        err,
      );
      const errorLabel = new LabelBuilder()
        .setTitle(`${emoji('icons_wrong')} Erro`)
        .setDescription(
          'Ocorreu um erro ao carregar o menu de profissões. Tente novamente mais tarde.',
        )
        .setColor(Colors.Red)
        .setFooter('Sistema de economia Wardcoins', emojiURL('icons_logo', true))
        .setTimestamp();

      await interaction.editReply({
        content: null,
        components: [errorLabel.build()],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }
  },
};
