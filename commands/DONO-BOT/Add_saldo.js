const { SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const db = require('../../handlers/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-saldo')
    .setDescription('Adiciona Wardcoins à carteira de um usuário (somente para o dono).')
    .addUserOption(option => 
      option.setName('usuario')
        .setDescription('Usuário que receberá os Wardcoins')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('quantidade')
        .setDescription('Quantidade de Wardcoins a adicionar')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1000000)), // Limite de 1.000.000 Wardcoins

  async execute(interaction) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('usuario');
    const quantidade = interaction.options.getInteger('quantidade');

    const emojis = {
      tools: '<:icons_tools:1353597168912437341>',
      coin: '<:icons_coin:1353597230195408917>',
      wrong: '<:icons_wrong:1353597190920212573>',
      loading: '<a:loading:1353898628149940326>',
      star: '<:icons_star:1353597390673936448>',
      logo: '<a:icons_logo:1353597304170483795>',
    };

    if (userId !== '1033922089436053535') {
      const embedErro = new EmbedBuilder()
        .setTitle(`${emojis.wrong} Acesso Negado`)
        .setDescription('Você não tem permissão para usar este comando!')
        .setColor('#FF0000')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      return interaction.reply({ embeds: [embedErro], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();

    try {
      await db.query(`
        INSERT INTO economia_usuarios (user_id, carteira, banco, ultima_trabalhar)
        VALUES (?, 0, 0, NULL)
        ON DUPLICATE KEY UPDATE user_id = user_id
      `, [targetUser.id]);

      const userRows = await db.query(`
        SELECT banco FROM economia_usuarios WHERE user_id = ?
      `, [targetUser.id]);
      const carteiraAtual = userRows[0]?.carteira || 0;

      const novoSaldo = carteiraAtual + quantidade;
      await db.query(`
        UPDATE economia_usuarios
        SET banco = ?
        WHERE user_id = ?
      `, [novoSaldo, targetUser.id]);

      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#00BFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const avatar = await loadImage(targetUser.displayAvatarURL({ extension: 'png', size: 128 }));
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
      ctx.fillText(`${targetUser.username}: +${quantidade.toLocaleString()}`, 120, 50);
      ctx.font = '20px Arial';
      ctx.fillText(`Novo Saldo: ${novoSaldo.toLocaleString()}`, 120, 90);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'add-saldo.png' });

      const embedSucesso = new EmbedBuilder()
        .setTitle(`${emojis.tools} Saldo Adicionado`)
        .setDescription(`💰 Adicionei **${quantidade.toLocaleString()} Wardcoins** à carteira de **${targetUser.username}**!`)
        .setColor('#00BFFF')
        .addFields(
          { name: `${emojis.coin} Novo Saldo`, value: `\`${novoSaldo.toLocaleString()}\` Wardcoins`, inline: true }
        )
        .setImage('attachment://add-saldo.png')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.editReply({ content: null, embeds: [embedSucesso], files: [attachment] });

    } catch (err) {
      console.error('Erro ao processar /add-saldo:', err);
      const embedErro = new EmbedBuilder()
        .setTitle(`${emojis.wrong} Erro`)
        .setDescription('Ocorreu um erro ao adicionar o saldo. Tente novamente mais tarde.')
        .setColor('#FF0000')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.editReply({ content: null, embeds: [embedErro], flags: MessageFlags.Ephemeral });
    }
  },
};