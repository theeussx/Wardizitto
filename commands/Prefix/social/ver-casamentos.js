const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const Canvas = require('@napi-rs/canvas');
const { format, differenceInDays } = require('date-fns');
const { ptBR } = require('date-fns/locale');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ver-casamento')
    .setDescription('Veja informações detalhadas sobre um casamento')
    .addUserOption(option =>
      option.setName('usuário')
        .setDescription('Usuário para ver o casamento')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();
      const { pool } = require('../../handlers/db');

      const alvo = interaction.options.getUser('usuário') || interaction.user;

      // Consulta ao banco de dados
      const [rows] = await pool.query(
        `SELECT * FROM casamentos 
         WHERE user_id = ? OR parceiro_id = ? 
         ORDER BY data DESC 
         LIMIT 1`,
        [alvo.id, alvo.id]
      );

      if (!rows || rows.length === 0) {
        const embed = new EmbedBuilder()
          .setColor('#FF9B9B')
          .setTitle('💔 Sem casamento')
          .setDescription(`${alvo.username} não está casado(a) no momento!`)
          .setThumbnail(alvo.displayAvatarURL({ dynamic: true }));
        
        return await interaction.editReply({ embeds: [embed] });
      }

      const casamento = rows[0];
      const parceiroId = casamento.user_id === alvo.id ? casamento.parceiro_id : casamento.user_id;
      const parceiro = await interaction.client.users.fetch(parceiroId).catch(() => null);

      if (!parceiro) {
        throw new Error('Parceiro não encontrado');
      }

      // Processamento da data
      const dataCasamento = new Date(Number(casamento.data));
      const diasJuntos = differenceInDays(new Date(), dataCasamento);
      const dataFormatada = format(dataCasamento, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

      // Criação da imagem - PARTE CRÍTICA
      const canvas = Canvas.createCanvas(800, 300);
      const ctx = canvas.getContext('2d');

      // 1. Fundo gradiente
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#ff9a9e');
      gradient.addColorStop(1, '#fad0c4');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. Função para carregar avatares
      const loadAvatar = async (user) => {
        try {
          return await Canvas.loadImage(
            user.displayAvatarURL({ extension: 'png', size: 256 })
          );
        } catch (error) {
          console.error('Erro ao carregar avatar:', error);
          // Fallback para imagem padrão se o avatar falhar
          return await Canvas.loadImage('https://cdn.discordapp.com/embed/avatars/0.png');
        }
      };

      // 3. Carrega ambos avatares simultaneamente
      const [avatar1, avatar2] = await Promise.all([
        loadAvatar(alvo),
        loadAvatar(parceiro)
      ]);

      // 4. Desenha os avatares
      // Avatar do alvo (esquerda)
      ctx.beginPath();
      ctx.arc(200, 150, 80, 0, Math.PI * 2);
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.drawImage(avatar1, 120, 70, 160, 160);
      ctx.restore();

      // Avatar do parceiro (direita)
      ctx.beginPath();
      ctx.arc(600, 150, 80, 0, Math.PI * 2);
      ctx.closePath();
      ctx.save();
      ctx.clip();
      ctx.drawImage(avatar2, 520, 70, 160, 160);
      ctx.restore();

      // 5. Coração entre os avatares
      ctx.font = 'bold 60px Arial';
      ctx.fillStyle = '#ff0000';
      ctx.fillText('❤', 400, 160);

      // 6. Textos informativos
      ctx.font = 'bold 30px Arial';
      ctx.fillStyle = '#5a2a38';
      ctx.textAlign = 'center';
      ctx.fillText(`${alvo.username} & ${parceiro.username}`, canvas.width / 2, 50);

      ctx.font = '24px Arial';
      ctx.fillText(`${diasJuntos} dias de felicidade`, canvas.width / 2, 280);

      // 7. Gera o buffer da imagem
      const buffer = await canvas.encode('png');
      const attachment = new AttachmentBuilder(buffer, { 
        name: 'casamento.png' // Nome mais simples para evitar problemas
      });

      // 8. Cria o embed com a imagem
      const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle(`💕 Casamento de ${alvo.username}`)
        .setDescription(`Casados desde ${dataFormatada}`)
        .setImage('attachment://casamento.png') // Deve corresponder ao name do attachment
        .setFooter({ text: 'Felizes para sempre!' });

      // 9. Envia a resposta
      await interaction.editReply({ 
        embeds: [embed], 
        files: [attachment],
        content: null // Garante que não há mensagem adicional
      });

    } catch (error) {
      console.error('Erro no comando ver-casamento:', error);
      
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF5555')
        .setTitle('❌ Erro ao gerar imagem do casamento')
        .setDescription('Ocorreu um problema ao criar a imagem. Por favor, tente novamente.');
      
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] });
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      }
    }
  }
};