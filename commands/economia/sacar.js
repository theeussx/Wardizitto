const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const db = require('../../handlers/db');
const config = require('../../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sacar')
    .setDescription('Saque Wardcoins do banco para a carteira')
    .addStringOption(option =>
      option
        .setName('quantia')
        .setDescription('Quantidade a sacar ou "tudo" pra sacar todo o saldo')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const quantiaInput = interaction.options.getString('quantia').toLowerCase();
    const contaSistemaId = config.contaSistemaId || '1033922089436053535';

    // Emojis personalizados
    const emojis = {
      bank: '<:icons_bank:1353597208544542822>',
      coin: '<:icons_coin:1353597230195408917>',
      wrong: '<:icons_wrong:1353597190920212573>',
      loading: '<a:loading:1353898628149940326>',
      star: '<:icons_star:1353597390673936448>',
      logo: '<a:icons_logo:1353597304170483795>',
    };

    // Mensagem de loading (efêmera)
    await interaction.reply({
      content: `${emojis.loading} Processando seu saque...`,
      flags: MessageFlags.Ephemeral
    });

    try {
      // Consultar saldo
      const rows = await db.query(`
        SELECT carteira, banco FROM economia_usuarios WHERE user_id = ?
      `, [userId]);

      if (!Array.isArray(rows) || rows.length === 0) {
        const embedErro = new EmbedBuilder()
          .setTitle(`${emojis.wrong} Erro`)
          .setDescription('Você não está registrado no sistema de economia. Use `/daily` para começar!')
          .setColor('#FF0000')
          .setFooter({
            text: 'Sistema de economia Wardcoins',
            iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif`
          })
          .setTimestamp();

        return interaction.editReply({ content: null, embeds: [embedErro], flags: MessageFlags.Ephemeral });
      }

      const saldoBanco = rows[0].banco ?? 0;
      const saldoCarteira = rows[0].carteira ?? 0;

      // Validar quantia
      let quantia;
      if (quantiaInput === 'tudo') {
        quantia = saldoBanco;
      } else {
        quantia = parseInt(quantiaInput, 10);
        if (isNaN(quantia) || quantia < 100) {
          const embedErro = new EmbedBuilder()
            .setTitle(`${emojis.wrong} Valor Inválido`)
            .setDescription('Insira um valor numérico maior ou igual a 100 ou "tudo".')
            .setColor('#FF0000')
            .setFooter({
              text: 'Sistema de economia Wardcoins',
              iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif`
            })
            .setTimestamp();

          return interaction.editReply({ content: null, embeds: [embedErro], flags: MessageFlags.Ephemeral });
        }
      }

      // Verificar saldo suficiente
      if (saldoBanco < quantia) {
        const canvas = createCanvas(600, 200);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px Arial';
        ctx.fillText('Saldo Insuficiente!', 20, 80);
        ctx.font = '20px Arial';
        ctx.fillText(`Banco: ${saldoBanco.toLocaleString()} Wardcoins`, 20, 120);
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'sacar-error.png' });

        const embedErro = new EmbedBuilder()
          .setTitle(`${emojis.wrong} Saldo Insuficiente`)
          .setDescription('Você não tem Wardcoins suficientes no banco para sacar.')
          .setColor('#FF0000')
          .addFields({
            name: `${emojis.bank} Saldo no Banco`,
            value: `\`${saldoBanco.toLocaleString()}\` Wardcoins`,
            inline: true,
          })
          .setImage('attachment://sacar-error.png')
          .setFooter({
            text: 'Sistema de economia Wardcoins',
            iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif`
          })
          .setTimestamp();

        return interaction.editReply({ content: null, embeds: [embedErro], files: [attachment], flags: MessageFlags.Ephemeral });
      }

      const imposto = Math.floor(quantia * 0.05);
      const valorFinal = quantia - imposto;

      // Transação no banco
      if (!db.pool) {
        throw new Error('Conexão com banco de dados indisponível.');
      }

      const connection = await db.pool.getConnection();
      try {
        await connection.beginTransaction();

        await connection.query(`
          UPDATE economia_usuarios
          SET banco = banco - ?, carteira = carteira + ?
          WHERE user_id = ?
        `, [quantia, valorFinal, userId]);

        await connection.query(`
          INSERT INTO economia_usuarios (user_id, carteira, banco)
          VALUES (?, ?, 0)
          ON DUPLICATE KEY UPDATE carteira = carteira + ?
        `, [contaSistemaId, imposto, imposto]);

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      // Criar banner
      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#00BFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Avatar
      const avatar = await loadImage(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }));
      ctx.save();
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 20, 20, 80, 80);
      ctx.restore();

      // Borda
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true);
      ctx.stroke();

      // Texto
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Arial';
      ctx.fillText(`Saque: ${valorFinal.toLocaleString()} Wardcoins`, 120, 50);
      ctx.font = '20px Arial';
      ctx.fillText(`Imposto (5%): ${imposto.toLocaleString()} Wardcoins`, 120, 90);
      ctx.fillText(`Carteira: ${(saldoCarteira + valorFinal).toLocaleString()}`, 120, 120);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'sacar-success.png' });

      // Embed sucesso
      const embedSucesso = new EmbedBuilder()
        .setTitle(`${emojis.coin} Saque Concluído`)
        .setDescription(`💸 Você sacou **${valorFinal.toLocaleString()} Wardcoins** do banco!\nImposto de 5%: **${imposto.toLocaleString()} Wardcoins**.`)
        .setColor('#00BFFF')
        .addFields(
          { name: `${emojis.coin} Carteira Atual`, value: `\`${(saldoCarteira + valorFinal).toLocaleString()}\` Wardcoins`, inline: true },
          { name: `${emojis.bank} Banco Atual`, value: `\`${(saldoBanco - quantia).toLocaleString()}\` Wardcoins`, inline: true },
          { name: `${emojis.star} Status`, value: 'Saque realizado com sucesso!', inline: false }
        )
        .setImage('attachment://sacar-success.png')
        .setFooter({
          text: 'Sistema de economia Wardcoins',
          iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif`
        })
        .setTimestamp();

      await interaction.editReply({
        content: null,
        embeds: [embedSucesso],
        files: [attachment],
        flags: MessageFlags.Ephemeral,
      });

    } catch (err) {
      console.error('Erro ao processar o comando /sacar:', err);
      const embedErro = new EmbedBuilder()
        .setTitle(`${emojis.wrong} Erro`)
        .setDescription('Ocorreu um erro ao processar o saque. Tente novamente mais tarde.')
        .setColor('#FF0000')
        .setFooter({
          text: 'Sistema de economia Wardcoins',
          iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif`
        })
        .setTimestamp();

      await interaction.editReply({
        content: null,
        embeds: [embedErro],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};