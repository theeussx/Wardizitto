const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const db = require('../../handlers/db');

const transacoesPendentes = new Map();

const emojis = {
  tools: '<:icons_tools:1353597168912437341>',
  coin: '<:icons_coin:1353597230195408917>',
  wrong: '<:icons_wrong:1353597190920212573>',
  loading: '<a:loading:1353898628149940326>',
  star: '<:icons_star:1353597390673936448>',
  logo: '<a:icons_logo:1353597304170483795>',
};

function embedBase({ title, description, color }) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transferir')
    .setDescription('Transfere Wardcoins para outro usuário (o destinatário deve aceitar).')
    .addUserOption(option => 
      option.setName('destinatario')
        .setDescription('Usuário que receberá os Wardcoins')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('quantidade')
        .setDescription('Quantidade de Wardcoins a transferir')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000000)),

  async execute(interaction) {
    const remetenteId = interaction.user.id;
    const destinatario = interaction.options.getUser('destinatario');
    const quantidade = interaction.options.getInteger('quantidade');

    if (!quantidade || quantidade <= 0) {
      return interaction.reply({ content: 'Quantidade inválida.', ephemeral: true });
    }

    if (remetenteId === destinatario.id) {
      return interaction.reply({
        embeds: [embedBase({ 
          title: `${emojis.wrong} Erro`, 
          description: 'Você não pode transferir Wardcoins pra si mesmo!', 
          color: '#FF0000' 
        })],
        ephemeral: true
      });
    }

    if (destinatario.bot) {
      return interaction.reply({
        embeds: [embedBase({ 
          title: `${emojis.wrong} Erro`, 
          description: 'Você não pode transferir para bots.', 
          color: '#FF0000' 
        })],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      await db.query(`
        INSERT INTO economia_usuarios (user_id, carteira, banco, ultima_trabalhar)
        VALUES (?, 0, 0, NULL), (?, 0, 0, NULL)
        ON DUPLICATE KEY UPDATE user_id = user_id
      `, [remetenteId, destinatario.id]);

      const remetenteRows = await db.query(`
        SELECT carteira FROM economia_usuarios WHERE user_id = ?
      `, [remetenteId]);
      const carteiraRemetente = remetenteRows[0]?.carteira || 0;

      if (carteiraRemetente < quantidade) {
        return interaction.editReply({
          embeds: [embedBase({ 
            title: `${emojis.wrong} Erro`, 
            description: `Você não tem Wardcoins suficientes! Saldo atual: ${carteiraRemetente.toLocaleString()}`, 
            color: '#FF0000' 
          })]
        });
      }

      const transacaoId = `${remetenteId}-${destinatario.id}-${Date.now()}`;
      const dataExpiracao = Date.now() + 24 * 60 * 60 * 1000;

      transacoesPendentes.set(transacaoId, {
        remetenteId,
        destinatarioId: destinatario.id,
        quantidade,
        dataExpiracao,
      });

      // Criar canvas com avatares
      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Função auxiliar para desenhar avatar circular centralizado
      async function desenharAvatarCircular(ctx, imageUrl, centerX, centerY, size) {
        const img = await loadImage(imageUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, centerX - size / 2, centerY - size / 2, size, size);
        ctx.restore();
      }

      const avatarSize = 78;
      const remetenteX = 60;
      const remetenteY = 60;
      const destinatarioX = 540;
      const destinatarioY = 60;

      // Desenhar avatares
      await desenharAvatarCircular(ctx, interaction.user.displayAvatarURL({ extension: 'png', size: 128 }), remetenteX, remetenteY, avatarSize);
      await desenharAvatarCircular(ctx, destinatario.displayAvatarURL({ extension: 'png', size: 128 }), destinatarioX, destinatarioY, avatarSize);

      // Desenhar contornos dos avatares separadamente
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;

      // Contorno avatar remetente
      ctx.beginPath();
      ctx.arc(remetenteX, remetenteY, avatarSize / 2, 0, Math.PI * 2);
      ctx.stroke();

      // Contorno avatar destinatário
      ctx.beginPath();
      ctx.arc(destinatarioX, destinatarioY, avatarSize / 2, 0, Math.PI * 2);
      ctx.stroke();

      // Linha entre os dois avatares, iniciando e terminando na borda dos círculos
      ctx.beginPath();
      ctx.moveTo(remetenteX + avatarSize / 2, remetenteY);       // borda direita do avatar esquerdo
      ctx.lineTo(destinatarioX - avatarSize / 2, destinatarioY); // borda esquerda do avatar direito
      ctx.stroke();

      // Textos na imagem
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px Arial';
      ctx.fillText(`Transferência: ${quantidade.toLocaleString()}`, 240, 60);
      ctx.font = '16px Arial';
      ctx.fillText('Aceite em até 24h', 240, 100);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: `transferencia-${transacaoId}.png` });

      const embedSolicitacao = embedBase({
        title: `${emojis.tools} Solicitação de Transferência`,
        description: `**${interaction.user.username}** quer transferir **${quantidade.toLocaleString()} Wardcoins** para **${destinatario.username}**!\nO valor será depositado no banco.`,
        color: '#FFD700'
      }).setImage('attachment://transferencia-' + transacaoId + '.png');

      const aceitarButton = new ButtonBuilder()
        .setCustomId(`aceitar_${transacaoId}`)
        .setLabel('Aceitar')
        .setStyle(ButtonStyle.Success);

      const recusarButton = new ButtonBuilder()
        .setCustomId(`recusar_${transacaoId}`)
        .setLabel('Recusar')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder()
        .addComponents(aceitarButton, recusarButton);

      const mensagem = await interaction.editReply({ embeds: [embedSolicitacao], files: [attachment], components: [row], fetchReply: true });

      const filter = i => (i.customId === `aceitar_${transacaoId}` || i.customId === `recusar_${transacaoId}`) && i.user.id === destinatario.id;
      const collector = mensagem.createMessageComponentCollector({ filter, time: 24 * 60 * 60 * 1000 });

      collector.on('collect', async i => {
        try {
          const [action, id] = i.customId.split('_');
          if (id !== transacaoId) return;

          if (action === 'aceitar') {
            const remetenteRowsAtual = await db.query(`SELECT carteira FROM economia_usuarios WHERE user_id = ?`, [remetenteId]);
            const carteiraAtual = remetenteRowsAtual[0]?.carteira || 0;

            if (carteiraAtual < quantidade) {
              return i.update({
                embeds: [embedBase({
                  title: `${emojis.wrong} Erro`,
                  description: 'O remetente não tem Wardcoins suficientes para completar a transferência!',
                  color: '#FF0000'
                })],
                components: []
              });
            }

            await db.query(`UPDATE economia_usuarios SET carteira = carteira - ? WHERE user_id = ?`, [quantidade, remetenteId]);
            await db.query(`UPDATE economia_usuarios SET banco = banco + ? WHERE user_id = ?`, [quantidade, destinatario.id]);

            await i.update({
              embeds: [embedBase({
                title: `${emojis.tools} Transferência Concluída`,
                description: `**${destinatario.username}** aceitou a transferência de **${quantidade.toLocaleString()} Wardcoins**!\nO valor foi depositado no banco.`,
                color: '#00BFFF'
              })],
              components: []
            });
          } else if (action === 'recusar') {
            await i.update({
              embeds: [embedBase({
                title: `${emojis.wrong} Transferência Recusada`,
                description: `**${destinatario.username}** recusou a transferência de **${quantidade.toLocaleString()} Wardcoins**.`,
                color: '#FF0000'
              })],
              components: []
            });
          }

          transacoesPendentes.delete(transacaoId);
        } catch (error) {
          console.error('Erro no collector /transferir:', error);
        }
      });

      collector.on('end', async collected => {
        try {
          if (collected.size === 0 && transacoesPendentes.has(transacaoId)) {
            await interaction.editReply({
              embeds: [embedBase({
                title: `${emojis.wrong} Transferência Expirada`,
                description: `A transferência de **${quantidade.toLocaleString()} Wardcoins** para **${destinatario.username}** expirou após 24 horas.`,
                color: '#FF0000'
              })],
              components: []
            });
            transacoesPendentes.delete(transacaoId);
          }
        } catch (error) {
          console.error('Erro no collector end /transferir:', error);
        }
      });

    } catch (err) {
      console.error('Erro ao processar /transferir:', err);
      return interaction.editReply({
        embeds: [embedBase({
          title: `${emojis.wrong} Erro`,
          description: 'Ocorreu um erro ao processar a transferência. Tente novamente mais tarde.',
          color: '#FF0000'
        })],
        ephemeral: true
      });
    }
  },
};
