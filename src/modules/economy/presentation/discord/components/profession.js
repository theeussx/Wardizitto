const { AttachmentBuilder, MessageFlags } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const db = require('../../../../../infrastructure/database/legacy.js');
const {
  LabelBuilder,
  Colors,
  emoji,
  emojiURL,
} = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'selecionar_profissao')
      return;

    const userId = interaction.user.id;
    const selectedProfession = interaction.values[0];

    try {
      // Atualizar ou inserir a profissão no banco
      await db.query(
        `
        INSERT INTO economia_profissoes (user_id, profissao)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE profissao = ?
      `,
        [userId, selectedProfession, selectedProfession],
      );

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
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true); // Avatar circular
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 20, 20, 80, 80);
      ctx.restore();

      // Borda do avatar
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true);
      ctx.stroke();

      // Texto
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Arial';
      ctx.fillText(`Profissão: ${selectedProfession}`, 120, 50);
      ctx.font = '20px Arial';
      ctx.fillText('Use /trabalhar para ganhar Wardcoins!', 120, 90);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), {
        name: 'profissao-selected.png',
      });

      // Rótulo de sucesso
      const label = new LabelBuilder()
        .setTitle(`${emoji('eg_tools')} Profissão Escolhida`)
        .setDescription(
          `${emoji('correct', true)} Você escolheu **${selectedProfession}**! Use **/trabalhar** para ganhar Wardcoins!`,
        )
        .setColor('#00BFFF')
        .addField(`${emoji('icons_star')} Próximo Passo`, 'Experimente o comando `/trabalhar`!')
        .setImage('attachment://profissao-selected.png')
        .setFooter('Sistema de economia Wardcoins', emojiURL('icons_logo', true))
        .setTimestamp();

      await interaction.update({
        content: null,
        components: [label.build()],
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
      });
    } catch (err) {
      interaction.client.services.logger.error('Erro ao processar seleção de profissão:', err);

      const errorLabel = new LabelBuilder()
        .setTitle(`${emoji('icons_wrong')} Erro`)
        .setDescription('Ocorreu um erro ao salvar sua profissão. Tente novamente mais tarde.')
        .setColor(Colors.Red)
        .setFooter('Sistema de economia Wardcoins', emojiURL('icons_logo', true))
        .setTimestamp();

      await interaction.update({
        content: null,
        components: [errorLabel.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  },
};
