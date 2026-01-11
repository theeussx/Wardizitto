const { SlashCommandBuilder, EmbedBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const db = require('../../handlers/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remover-saldo')
    .setDescription('Remove Wardcoins da carteira ou banco de um usuário (somente para o dono).')
    .addUserOption(option => 
      option.setName('usuario')
        .setDescription('Usuário que terá os Wardcoins removidos')
        .setRequired(true))
    .addIntegerOption(option => 
      option.setName('quantidade')
        .setDescription('Quantidade de Wardcoins a remover')
        .setRequired(true)
        .setMinValue(1))
    .addStringOption(option => 
      option.setName('origem')
        .setDescription('De onde remover (carteira ou banco)')
        .setRequired(true)
        .addChoices(
          { name: 'Carteira', value: 'carteira' },
          { name: 'Banco', value: 'banco' }
        )),

  async execute(interaction) {
    const userId = interaction.user.id;
    const targetUser = interaction.options.getUser('usuario');
    const quantidade = interaction.options.getInteger('quantidade');
    const origem = interaction.options.getString('origem');

    const emojis = {
      tools: '<:icons_tools:1353597168912437341>',
      coin: '<:icons_coin:1353597230195408917>',
      wrong: '<:icons_wrong:1353597190920212573>',
      loading: '<a:loading:1353898628149940326>',
      star: '<:icons_star:1353597390673936448>',
      logo: '<a:icons_logo:1353597304170483795>',
    };

    // Verifica se é o dono
    if (userId !== '1033922089436053535') {
      const embedErro = new EmbedBuilder()
        .setTitle(`${emojis.wrong} Acesso Negado`)
        .setDescription('Você não tem permissão para usar este comando!')
        .setColor('#FF0000')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      return interaction.reply({ embeds: [embedErro], flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply(); // Aguarda processamento

    try {
      // Inicializar usuário no banco, se não existir
      await db.query(`
        INSERT INTO economia_usuarios (user_id, carteira, banco, ultima_trabalhar)
        VALUES (?, 0, 0, NULL)
        ON DUPLICATE KEY UPDATE user_id = user_id
      `, [targetUser.id]);

      // Buscar saldo atual
      const userRows = await db.query(`
        SELECT carteira, banco FROM economia_usuarios WHERE user_id = ?
      `, [targetUser.id]);
      const { carteira, banco } = userRows[0] || { carteira: 0, banco: 0 };

      let saldoAtual, novoSaldo, campoAtualizar;
      if (origem === 'carteira') {
        saldoAtual = carteira;
        campoAtualizar = 'carteira';
      } else if (origem === 'banco') {
        saldoAtual = banco;
        campoAtualizar = 'banco';
      }

      // Verificar se há saldo suficiente
      if (saldoAtual < quantidade) {
        const embedErro = new EmbedBuilder()
          .setTitle(`${emojis.wrong} Erro`)
          .setDescription(`O usuário **${targetUser.username}** não tem Wardcoins suficientes no ${origem}! Saldo atual: ${saldoAtual.toLocaleString()}`)
          .setColor('#FF0000')
          .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
          .setTimestamp();

        return interaction.editReply({ embeds: [embedErro] });
      }

      // Remover saldo
      novoSaldo = saldoAtual - quantidade;
      await db.query(`
        UPDATE economia_usuarios
        SET ${campoAtualizar} = ?
        WHERE user_id = ?
      `, [novoSaldo, targetUser.id]);

      // Criar canvas
      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FF4500'; // Cor alaranjada pra remoção
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
      ctx.fillText(`${targetUser.username}: -${quantidade.toLocaleString()} (${origem})`, 120, 50);
      ctx.font = '20px Arial';
      ctx.fillText(`Novo Saldo: ${novoSaldo.toLocaleString()}`, 120, 90);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'remover-saldo.png' });

      const embedSucesso = new EmbedBuilder()
        .setTitle(`${emojis.tools} Saldo Removido`)
        .setDescription(`💸 Removi **${quantidade.toLocaleString()} Wardcoins** do ${origem} de **${targetUser.username}**!`)
        .setColor('#FF4500')
        .addFields(
          { name: `${emojis.coin} Novo Saldo (${origem.charAt(0).toUpperCase() + origem.slice(1)})`, value: `\`${novoSaldo.toLocaleString()}\` Wardcoins`, inline: true }
        )
        .setImage('attachment://remover-saldo.png')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.editReply({ content: null, embeds: [embedSucesso], files: [attachment] });

    } catch (err) {
      console.error('Erro ao processar /remover-saldo:', err);
      const embedErro = new EmbedBuilder()
        .setTitle(`${emojis.wrong} Erro`)
        .setDescription('Ocorreu um erro ao remover o saldo. Tente novamente mais tarde.')
        .setColor('#FF0000')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.editReply({ content: null, embeds: [embedErro], flags: MessageFlags.Ephemeral });
    }
  },
};