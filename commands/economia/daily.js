const { SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { createCanvas } = require('canvas');
const db = require('../../handlers/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Receba sua recompensa Wardcoins diária!'),

  async execute(interaction) {
    const userId = interaction.user.id;
    const agora = new Date();

    // Emojis personalizados
    const emojis = {
      coin: '<:icons_coin:1353597230195408917>',
      clock: '<:icons_clock:1353597227146412094>',
      wrong: '<:icons_wrong:1353597190920212573>',
      loading: '<a:loading:1353898628149940326>',
      star: '<:icons_star:1353597390673936448>',
      logo: '<a:icons_logo:1353597304170483795>',
    };

    await interaction.reply({ content: `${emojis.loading} Processando sua recompensa diária...`, flags: MessageFlags.Ephemeral });
    
    try {
      // Inicializar usuário
      await db.query(`
        INSERT INTO economia_usuarios (user_id, carteira, banco, ultima_daily)
        VALUES (?, 0, 0, NULL)
        ON DUPLICATE KEY UPDATE user_id = user_id
      `, [userId]);

      // Consultar dados
      const rows = await db.query(`
        SELECT carteira, ultima_daily FROM economia_usuarios WHERE user_id = ?
      `, [userId]);

      if (!Array.isArray(rows) || rows.length === 0) {
        const embedErro = new EmbedBuilder()
          .setTitle(`${emojis.wrong} Erro`)
          .setDescription('Usuário não encontrado no sistema de economia.')
          .setColor('#FF0000')
          .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
          .setTimestamp();

        return interaction.editReply({ content: null, embeds: [embedErro], flags: MessageFlags.Ephemeral });
      }

      const { carteira, ultima_daily } = rows[0];
      let diffHoras = 24;

      if (ultima_daily) {
        const ultimaDaily = new Date(ultima_daily);
        if (!isNaN(ultimaDaily.getTime())) {
          const diffMs = agora.getTime() - ultimaDaily.getTime();
          diffHoras = diffMs / (1000 * 60 * 60);
        }
      }

      // Verificar cooldown
      if (diffHoras < 24) {
        const tempoRestanteMs = (24 * 60 * 60 * 1000) - Math.floor(diffHoras * 60 * 60 * 1000);
        const horasRestantes = Math.floor(tempoRestanteMs / (1000 * 60 * 60));
        const minutosRestantes = Math.floor((tempoRestanteMs % (1000 * 60 * 60)) / (1000 * 60));
        const tempoRestante = horasRestantes > 0
          ? `${horasRestantes} hora${horasRestantes > 1 ? 's' : ''}${minutosRestantes > 0 ? ` e ${minutosRestantes} minuto${minutosRestantes > 1 ? 's' : ''}` : ''}`
          : `${minutosRestantes} minuto${minutosRestantes > 1 ? 's' : ''}`;

        const canvas = createCanvas(600, 200);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px Arial';
        ctx.fillText('Cooldown Ativo!', 20, 80);
        ctx.font = '20px Arial';
        ctx.fillText(`Tente novamente em: ${tempoRestante}`, 20, 120);
        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'daily-cooldown.png' });

        const embedCooldown = new EmbedBuilder()
          .setTitle(`${emojis.clock} Cooldown Ativo`)
          .setDescription(`Você já coletou seus Wardcoins! Tente novamente em **${tempoRestante}**.`)
          .setColor('#FF4500')
          .setImage('attachment://daily-cooldown.png')
          .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
          .setTimestamp();

        return interaction.editReply({ content: null, embeds: [embedCooldown], files: [attachment], flags: MessageFlags.Ephemeral });
      }

      // Gerar recompensa
      const recompensa = Math.floor(Math.random() * (4000 - 1500 + 1)) + 1500;

      // Criar banner
      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#00BFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px Arial';
      ctx.fillText(`${recompensa.toLocaleString()} Wardcoins!`, 20, 80);
      ctx.font = '20px Arial';
      ctx.fillText(`Saldo: ${(carteira + recompensa).toLocaleString()}`, 20, 120);
      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'daily-reward.png' });

      // Atualizar banco
      await db.query(`
        UPDATE economia_usuarios
        SET carteira = carteira + ?, ultima_daily = ?
        WHERE user_id = ?
      `, [recompensa, agora.toISOString().slice(0, 19).replace('T', ' '), userId]);

      // Embed de sucesso
      const embedSucesso = new EmbedBuilder()
        .setTitle(`${emojis.coin} Recompensa Diária`)
        .setDescription(`Você recebeu **${recompensa.toLocaleString()} Wardcoins**!`)
        .setColor('#00BFFF')
        .addFields(
          { name: `${emojis.star} Saldo Atual`, value: `\`${(carteira + recompensa).toLocaleString()}\` Wardcoins`, inline: true },
          { name: '━━━━━━', value: 'Coletado com sucesso!', inline: false }
        )
        .setImage('attachment://daily-reward.png')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      return interaction.editReply({ content: null, embeds: [embedSucesso], files: [attachment], flags: MessageFlags.Ephemeral });

    } catch (error) {
      console.error('Erro ao processar o comando /daily:', error);
      const embedErro = new EmbedBuilder()
        .setTitle(`${emojis.wrong} Erro`)
        .setDescription('Ocorreu um erro ao processar sua recompensa diária. Tente novamente.')
        .setColor('#FF0000')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      return interaction.editReply({ content: null, embeds: [embedErro], flags: MessageFlags.Ephemeral });
    }
  },
};