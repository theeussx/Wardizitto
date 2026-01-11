const { SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const db = require('../../handlers/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('depositar')
    .setDescription('Deposite Wardcoins da carteira para o banco')
    .addStringOption((option) =>
      option
        .setName('quantia')
        .setDescription('Valor a depositar ou "tudo" para depositar todo o saldo')
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const quantiaInput = interaction.options.getString('quantia').toLowerCase();

    // Emojis personalizados
    const emojis = {
      bank: '<:icons_bank:1353597208544542822>',
      coin: '<:icons_coin:1353597230195408917>',
      wrong: '<:icons_wrong:1353597190920212573>',
      loading: '<a:loading:1353898628149940326>',
      star: '<:icons_star:1353597390673936448>',
      logo: '<a:icons_logo:1353597304170483795>',
    };

    // Mensagem de loading
    await interaction.reply({ content: `${emojis.loading} Processando seu depósito...`, flags: MessageFlags.Ephemeral });

    try {
      // Inicializar usuário
      await db.query(`
        INSERT INTO economia_usuarios (user_id, carteira, banco)
        VALUES (?, 0, 0)
        ON DUPLICATE KEY UPDATE user_id = user_id
      `, [userId]);

      // Consultar saldo
      const rows = await db.query(`
        SELECT carteira, banco FROM economia_usuarios WHERE user_id = ?
      `, [userId]);

      // Verificar se o usuário está registrado
      if (!Array.isArray(rows) || rows.length === 0) {
        const embedErro = new EmbedBuilder()
          .setTitle(`${emojis.wrong} Erro`)
          .setDescription('Usuário não encontrado no sistema de economia. Use `/daily` para começar!')
          .setColor('#FF0000')
          .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
          .setTimestamp();

        return interaction.editReply({ content: null, embeds: [embedErro], flags: MessageFlags.Ephemeral });
      }

      const saldoAtual = rows[0].carteira;
      const bancoAtual = rows[0].banco;

      // Validar quantia
      let quantia;
      if (quantiaInput === 'tudo') {
        quantia = saldoAtual;
      } else {
        quantia = parseInt(quantiaInput, 10);
        if (isNaN(quantia) || quantia < 1) {
          const embedErro = new EmbedBuilder()
            .setTitle(`${emojis.wrong} Valor Inválido`)
            .setDescription('Insira um valor numérico válido maior que 0 ou "tudo".')
            .setColor('#FF0000')
            .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
            .setTimestamp();

          return interaction.editReply({ content: null, embeds: [embedErro], flags: MessageFlags.Ephemeral });
        }
      }

      // Verificar saldo suficiente
      if (saldoAtual < quantia) {
        const canvas = createCanvas(600, 200);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px Arial';
        ctx.fillText('Saldo Insuficiente!', 20, 80);
        ctx.font = '20px Arial';
        ctx.fillText(`Carteira: ${saldoAtual.toLocaleString()} Wardcoins`, 20, 120);
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'depositar-error.png' });

        const embedErro = new EmbedBuilder()
          .setTitle(`${emojis.wrong} Saldo Insuficiente`)
          .setDescription('Você não tem Wardcoins suficientes na carteira para depositar.')
          .setColor('#FF0000')
          .addFields({
            name: `${emojis.coin} Saldo Atual`,
            value: `\`${saldoAtual.toLocaleString()}\` Wardcoins`,
            inline: true,
          })
          .setImage('attachment://depositar-error.png')
          .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
          .setTimestamp();

        return interaction.editReply({ content: null, embeds: [embedErro], files: [attachment], flags: MessageFlags.Ephemeral });
      }

      // Atualizar carteira e banco
      await db.query(`
        UPDATE economia_usuarios
        SET carteira = carteira - ?, banco = banco + ?
        WHERE user_id = ?
      `, [quantia, quantia, userId]);

      // Criar banner
      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#00BFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px Arial';
      ctx.fillText(`Depósito: ${quantia.toLocaleString()} Wardcoins`, 20, 80);
      ctx.font = '20px Arial';
      ctx.fillText(`Carteira: ${(saldoAtual - quantia).toLocaleString()} | Banco: ${(bancoAtual + quantia).toLocaleString()}`, 20, 120);
      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'depositar-success.png' });

      // Embed de sucesso
      const embedSucesso = new EmbedBuilder()
        .setTitle(`${emojis.bank} Depósito Concluído`)
        .setDescription(`Você depositou **${quantia.toLocaleString()} Wardcoins** no banco!`)
        .setColor('#00BFFF')
        .addFields(
          { name: `${emojis.coin} Carteira Atual`, value: `\`${(saldoAtual - quantia).toLocaleString()}\` Wardcoins`, inline: true },
          { name: `${emojis.bank} Banco Atual`, value: `\`${(bancoAtual + quantia).toLocaleString()}\` Wardcoins`, inline: true },
          { name: `${emojis.star} Status`, value: 'Depósito realizado com sucesso!', inline: false }
        )
        .setImage('attachment://depositar-success.png')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.editReply({
        content: null,
        embeds: [embedSucesso],
        files: [attachment],
        flags: MessageFlags.Ephemeral,
      });

    } catch (err) {
      console.error('Erro ao processar o comando /depositar:', err);
      const embedErro = new EmbedBuilder()
        .setTitle(`${emojis.wrong} Erro`)
        .setDescription('Ocorreu um erro ao processar o depósito. Tente novamente mais tarde.')
        .setColor('#FF0000')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.editReply({
        content: null,
        embeds: [embedErro],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};