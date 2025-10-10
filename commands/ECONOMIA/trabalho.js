const { SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const db = require('../../handlers/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trabalhar')
    .setDescription('Trabalhe com sua profissão para ganhar Wardcoins!'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const agora = new Date();

    const emojis = {
      tools: '<:icons_tools:1353597168912437341>',
      coin: '<:icons_coin:1353597230195408917>',
      wrong: '<:icons_wrong:1353597190920212573>',
      loading: '<a:loading:1353898628149940326>',
      star: '<:icons_star:1353597390673936448>',
      logo: '<a:icons_logo:1353597304170483795>',
    };

    await interaction.reply({ content: `${emojis.loading} Processando seu trabalho...`, flags: MessageFlags.Ephemeral });

    try {
      await db.query(`
        INSERT INTO economia_usuarios (user_id, carteira, banco, ultima_trabalhar)
        VALUES (?, 0, 0, NULL)
        ON DUPLICATE KEY UPDATE user_id = user_id
      `, [userId]);

      const profRows = await db.query(`
        SELECT profissao FROM economia_profissoes WHERE user_id = ?
      `, [userId]);

      const profissao = profRows[0]?.profissao;
      if (!profissao) {
        const canvas = createCanvas(600, 200);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px Arial';
        ctx.fillText('Sem Profissão!', 20, 80);
        ctx.font = '20px Arial';
        ctx.fillText('Use /escolher-profissao', 20, 120);
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'trabalhar-error.png' });

        const embedErro = new EmbedBuilder()
          .setTitle(`${emojis.wrong} Erro`)
          .setDescription('Você não tem uma profissão. Use `/escolher-profissao` para selecionar uma!')
          .setColor('#FF0000')
          .setImage('attachment://trabalhar-error.png')
          .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
          .setTimestamp();

        return interaction.editReply({ content: null, embeds: [embedErro], files: [attachment], flags: MessageFlags.Ephemeral });
      }

      const userRows = await db.query(`
        SELECT carteira, ultima_trabalhar FROM economia_usuarios WHERE user_id = ?
      `, [userId]);

      let ultima = null;
      let carteiraAtual = 0;

      if (Array.isArray(userRows) && userRows.length > 0) {
        ultima = userRows[0].ultima_trabalhar ? new Date(userRows[0].ultima_trabalhar) : null;
        carteiraAtual = userRows[0].carteira || 0;
      }

      const diffMinutes = ultima ? Math.floor((agora.getTime() - ultima.getTime()) / (1000 * 60)) : 61;
      console.log('Debug - Agora:', agora.toISOString(), 'Ultima:', ultima ? ultima.toISOString() : 'NULL', 'DiffMinutes:', diffMinutes);

      if (diffMinutes < 60) {
        const minutosRestantes = Math.ceil(60 - diffMinutes);
        const tempoRestante = minutosRestantes > 0
          ? `${minutosRestantes} minuto${minutosRestantes > 1 ? 's' : ''}`
          : 'menos de 1 minuto';

        const canvas = createCanvas(600, 200);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px Arial';
        ctx.fillText('Em Cooldown!', 20, 80);
        ctx.font = '20px Arial';
        ctx.fillText(`Espere ${tempoRestante}`, 20, 120);
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'trabalhar-cooldown.png' });

        const embedCooldown = new EmbedBuilder()
          .setTitle(`${emojis.wrong} Cooldown`)
          .setDescription(`⏱️ Você precisa esperar **${tempoRestante}** para trabalhar novamente.`)
          .setColor('#FF4500')
          .setImage('attachment://trabalhar-cooldown.png')
          .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
          .setTimestamp();

        return interaction.editReply({ content: null, embeds: [embedCooldown], files: [attachment], flags: MessageFlags.Ephemeral });
      }

      const ganhosPorProfissao = {
        Programador: { min: 2000, max: 3500 },
        Mecânico: { min: 1500, max: 3000 },
        Designer: { min: 1800, max: 3200 },
        Streamer: { min: 1700, max: 3100 },
        Músico: { min: 1600, max: 2900 },
      };
      const { min, max } = ganhosPorProfissao[profissao] || { min: 1500, max: 3000 };
      const ganho = Math.floor(Math.random() * (max - min + 1)) + min;

      const dataFormatada = agora.toISOString().slice(0, 19).replace('T', ' ');

      await db.query(`
        INSERT INTO economia_usuarios (user_id, carteira, ultima_trabalhar)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          carteira = carteira + ?,
          ultima_trabalhar = ?
      `, [userId, ganho, dataFormatada, ganho, dataFormatada]);

      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#00BFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const avatar = await loadImage(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }));
      ctx.save();
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 20, 20, 80, 80);
      ctx.restore();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Arial';
      ctx.fillText(`${profissao}: +${ganho.toLocaleString()}`, 120, 50);
      ctx.font = '20px Arial';
      ctx.fillText(`Carteira: ${(carteiraAtual + ganho).toLocaleString()}`, 120, 90);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'trabalhar-success.png' });

      const embedSucesso = new EmbedBuilder()
        .setTitle(`${emojis.tools} Trabalho Concluído`)
        .setDescription(`🧑‍💼 Você trabalhou como **${profissao}** e ganhou **${ganho.toLocaleString()} Wardcoins**!`)
        .setColor('#00BFFF')
        .addFields(
          { name: `${emojis.coin} Carteira Atual`, value: `\`${(carteiraAtual + ganho).toLocaleString()}\` Wardcoins`, inline: true },
          { name: `${emojis.star} Próximo Trabalho`, value: 'Disponível em 4 hora!', inline: true }
        )
        .setImage('attachment://trabalhar-success.png')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.editReply({ content: null, embeds: [embedSucesso], files: [attachment] });

    } catch (err) {
      console.error('Erro ao processar o comando /trabalhar:', err);
      const embedErro = new EmbedBuilder()
        .setTitle(`${emojis.wrong} Erro`)
        .setDescription('Ocorreu um erro ao processar o trabalho. Tente novamente mais tarde.')
        .setColor('#FF0000')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.editReply({ content: null, embeds: [embedErro], flags: MessageFlags.Ephemeral });
    }
  },
};