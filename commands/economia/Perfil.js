const { SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const db = require('../../handlers/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Veja o seu perfil econômico ou de outro usuário.')
    .addUserOption(option =>
      option.setName('usuário')
        .setDescription('Mencione um usuário para ver o perfil dele')
        .setRequired(false)
    ),

  async execute(interaction) {
    const membro = interaction.options.getUser('usuário') || interaction.user;
    const userId = membro.id;

    // Emojis personalizados
    const emojis = {
      coin: '<:icons_coin:1353597230195408917>',
      bank: '<:icons_bank:1353597208544542822>',
      tools: '<:icons_tools:1353597168912437341>',
      wrong: '<:icons_wrong:1353597190920212573>',
      star: '<:icons_star:1353597390673936448>',
      logo: '<a:icons_logo:1353597304170483795>',
    };

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

      const saldo = Array.isArray(rows) && rows.length > 0 ? rows[0].carteira : 0;
      const banco = Array.isArray(rows) && rows.length > 0 ? rows[0].banco : 0;
      const total = saldo + banco;

      // Buscar profissão
      const profRows = await db.query(`
        SELECT profissao FROM economia_profissoes WHERE user_id = ?
      `, [userId]);

      const profissao = (Array.isArray(profRows) && profRows.length > 0 && profRows[0].profissao)
        ? profRows[0].profissao
        : 'Nenhuma profissão definida';

      // Criar banner
      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');

      // Fundo
      ctx.fillStyle = '#00BFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Avatar
      const avatar = await loadImage(membro.displayAvatarURL({ extension: 'png', size: 128 }));
      ctx.save();
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true);
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
      ctx.fillText(membro.username, 120, 50);
      ctx.font = '20px Arial';
      ctx.fillText(`Carteira: ${saldo.toLocaleString()} Wardcoins`, 120, 90);
      ctx.fillText(`Banco: ${banco.toLocaleString()} Wardcoins`, 120, 120);
      ctx.fillText(`Total: ${total.toLocaleString()} Wardcoins`, 120, 150);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'perfil.png' });

      // Embed final
      const embed = new EmbedBuilder()
        .setTitle(`${emojis.star} Perfil Econômico`)
        .setDescription(`Informações econômicas de <@${membro.id}>`)
        .setColor('#00BFFF')
        .addFields(
          { name: `${emojis.tools} Profissão`, value: `\`${profissao}\``, inline: true },
          { name: `${emojis.coin} Carteira`, value: `\`${saldo.toLocaleString()}\` Wardcoins`, inline: true },
          { name: `${emojis.bank} Banco`, value: `\`${banco.toLocaleString()}\` Wardcoins`, inline: true },
          { name: `${emojis.star} Total`, value: `\`${total.toLocaleString()}\` Wardcoins`, inline: true },
          { name: '━━━━━━', value: 'Use `/daily` ou `/trabalhar` para ganhar mais!', inline: false }
        )
        .setImage('attachment://perfil.png')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        files: [attachment]
      });

    } catch (err) {
      console.error('Erro ao buscar perfil:', err);

      const embedErro = new EmbedBuilder()
        .setTitle(`${emojis.wrong} Erro`)
        .setDescription('Ocorreu um erro ao carregar o perfil econômico. Tente novamente mais tarde.')
        .setColor('#FF0000')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.reply({
        embeds: [embedErro],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};