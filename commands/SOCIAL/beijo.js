const { SlashCommandBuilder } = require('@discordjs/builders');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const mysql = require('mysql2/promise');
const config = require('../../config.json');

// Emojis personalizados
const emojis = {
  kiss: '<:eg_heart:1353597127091294208>',
  retribuir: '<:icons_heart:1353597437922775082>',
  alerta: '<:eg_cross:1353597108640415754>',
  corno: '<:eg_netual:1353597145646759986>',
  casal: '<:icons_verified:1353597412157034507>',
  destaque: '<:eg_star:1353597159752077419>',
  coracao: '💔',
  alianca: '💍'
};

// Conexão com MariaDB
const pool = mysql.createPool({
  host: config.mariaDB.host,
  user: config.mariaDB.user,
  password: config.mariaDB.password,
  database: config.mariaDB.database,
  waitForConnections: true,
  connectionLimit: 10
});

// Busca parceiro do usuário
async function getParceiroId(userId) {
  const [rows] = await pool.query(
    'SELECT parceiro_id FROM casamentos WHERE user_id = ?',
    [userId]
  );
  return rows.length > 0 ? rows[0].parceiro_id : null;
}

// Envia mensagem de corno
async function enviarMensagemCorno(client, userId, traidorNome, alvoNome, tipo = 'beijo') {
  try {
    const user = await client.users.fetch(userId);
    let mensagem = '';

    if (tipo === 'beijo') {
      mensagem =
        `${emojis.alerta} **ALERTA DE TRAIÇÃO!** ${emojis.alerta}\n\n` +
        `${emojis.corno} Seu parceiro(a) **${traidorNome}** deu um beijo em **${alvoNome}**!\n` +
        `${emojis.coracao} Esperamos que seja apenas um mal-entendido...`;
    } else {
      mensagem =
        `${emojis.alerta} **TRAIÇÃO CONFIRMADA!** ${emojis.alerta}\n\n` +
        `${emojis.corno} Seu parceiro(a) **${traidorNome}** recebeu e retribuiu um beijo de **${alvoNome}**!\n` +
        `${emojis.coracao} A confiança está sendo colocada à prova.`;
    }

    await user.send({ content: mensagem });
  } catch (err) {
    console.error(`❌ Erro ao enviar DM para ${userId}:`, err);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('beijo')
    .setDescription('「Social」Dê um beijo em alguém!')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('O usuário que você quer beijar')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply(); // ✅ Removido { flags: 64 } (não é mais privado)

    const usuario = interaction.options.getUser('usuario');
    const autor = interaction.user;
    const client = interaction.client;

    if (usuario.bot) return interaction.editReply({ content: `${emojis.alerta} Você não pode beijar bots!` });
    if (usuario.id === autor.id) return interaction.editReply({ content: `${emojis.alerta} Você não pode beijar a si mesmo!` });

    // Obter gif de beijo
    let gif;
    try {
      const response = await fetch('https://api.waifu.pics/sfw/kiss');
      const data = await response.json();
      gif = data.url;
    } catch (err) {
      console.error('Erro ao buscar gif:', err);
      return interaction.editReply({ content: `${emojis.alerta} Erro ao buscar o gif de beijo.` });
    }

    const parceiroDoAutor = await getParceiroId(autor.id);
    const parceiroDoAlvo = await getParceiroId(usuario.id);
    const saoCasadosEntreSi =
      (parceiroDoAutor === usuario.id) || (parceiroDoAlvo === autor.id);

    const embed = new EmbedBuilder()
      .setAuthor({ name: autor.username, iconURL: autor.displayAvatarURL({ dynamic: true }) })
      .setImage(gif)
      .setTimestamp();

    if (saoCasadosEntreSi) {
      embed
        .setTitle(`${emojis.destaque} AMOR VERDADEIRO! ${emojis.alianca}`)
        .setDescription(
          `${emojis.casal} **${autor}** e **${usuario}** selaram seu amor com um beijo apaixonado!\n\n` +
          `${emojis.destaque} Casal oficial detectado!\n${emojis.alianca} Que esse relacionamento continue abençoado!`
        )
        .setColor(0xFF69B4)
        .setFooter({ text: 'Casal abençoado por ErislyBot ✨' });
    } else {
      embed
        .setTitle(`${emojis.kiss} BEIJO ROMÂNTICO!`)
        .setDescription(
          `**${autor}** deu um beijo em **${usuario}**! ${emojis.kiss}\n\n` +
          `_Será que isso vai virar um romance?_ ${emojis.retribuir}`
        )
        .setColor(0xFF1493)
        .setFooter({ text: 'Beijos enviados com amor 💖' });
    }

    // CORNO 1: autor traiu
    if (parceiroDoAutor && parceiroDoAutor !== usuario.id) {
      await enviarMensagemCorno(client, parceiroDoAutor, autor.username, usuario.username, 'beijo');
      embed.setDescription(embed.data.description + `\n\n${emojis.alerta} **${autor.username}** parece estar comprometido(a)... ${emojis.corno}`);
    }

    // CORNO 2: beijaram seu parceiro
    if (parceiroDoAlvo === autor.id && usuario.id !== autor.id) {
      await enviarMensagemCorno(client, autor.id, autor.username, usuario.username, 'beijo');
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('retribuir_beijo')
        .setLabel('Retribuir Beijo')
        .setEmoji(emojis.retribuir)
        .setStyle(ButtonStyle.Primary)
    );

    const message = await interaction.editReply({ embeds: [embed], components: [row] });

    const filter = i => i.customId === 'retribuir_beijo';
    const collector = message.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async i => {
      if (i.user.id !== usuario.id) {
        return i.reply({ content: `${emojis.alerta} Apenas ${usuario} pode retribuir esse beijo!`, ephemeral: true }); // ✅ Aqui pode manter ephemeral (só o alvo vê)
      }

      let novoGif;
      try {
        const response = await fetch('https://api.waifu.pics/sfw/kiss');
        const data = await response.json();
        novoGif = data.url;
      } catch (error) {
        return i.reply({ content: `${emojis.alerta} Erro ao buscar novo gif.`, ephemeral: true }); // ✅ Pode manter ephemeral
      }

      const retribuirEmbed = new EmbedBuilder()
        .setTitle(`${emojis.kiss} BEIJO RETRIBUÍDO! ${emojis.retribuir}`)
        .setDescription(
          `**${usuario}** retribuiu o beijo de **${autor}**! ${emojis.kiss}\n\n` +
          `_O romance está florescendo..._ ${emojis.destaque}`
        )
        .setImage(novoGif)
        .setColor('#FF69B4')
        .setFooter({ text: 'Beijo retribuído com carinho 💞' })
        .setTimestamp();

      // CORNO 3: alvo retribuiu, mas é casado com outro
      if (parceiroDoAlvo && parceiroDoAlvo !== autor.id) {
        await enviarMensagemCorno(client, parceiroDoAlvo, usuario.username, autor.username, 'retribuicao');
        retribuirEmbed.setDescription(retribuirEmbed.data.description + `\n\n${emojis.alerta} **${usuario.username}** parece estar comprometido(a)... ${emojis.corno}`);
      }

      await i.update({ embeds: [retribuirEmbed], components: [] }); // ✅ Público (sem flags)
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        message.edit({ components: [] }).catch(console.error);
      }
    });
  }
};