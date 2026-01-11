const { SlashCommandBuilder } = require('@discordjs/builders');
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');

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
    const { query } = require('../../handlers/db');
    await interaction.deferReply();

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
      console.error('❌ Erro ao buscar gif:', err.message);
      return interaction.editReply({ content: `${emojis.alerta} Erro ao buscar o gif de beijo.` });
    }

    // Busca parceiros em paralelo
    let parceiroDoAutor, parceiroDoAlvo;
    try {
      const [autorRes, alvoRes] = await Promise.all([
        query(`SELECT parceiro_id FROM casamentos WHERE user_id = ? LIMIT 1`, [autor.id]),
        query(`SELECT parceiro_id FROM casamentos WHERE user_id = ? LIMIT 1`, [usuario.id])
      ]);
      
      parceiroDoAutor = autorRes[0]?.parceiro_id;
      parceiroDoAlvo = alvoRes[0]?.parceiro_id;
    } catch (error) {
      console.error('❌ Erro ao buscar parceiros:', error.message);
      return interaction.editReply({ content: `${emojis.alerta} Erro ao buscar informações.` });
    }

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
      try {
        const user = await client.users.fetch(parceiroDoAutor);
        await user.send({
          content: `${emojis.alerta} **ALERTA DE TRAIÇÃO!** ${emojis.alerta}\n\n${emojis.corno} Seu parceiro(a) **${autor.username}** deu um beijo em **${usuario.username}**!\n${emojis.coracao} Esperamos que seja apenas um mal-entendido...`
        });
      } catch (err) {
        console.error(`❌ Erro ao enviar DM para ${parceiroDoAutor}:`, err.message);
      }
      embed.setDescription(embed.data.description + `\n\n${emojis.alerta} **${autor.username}** parece estar comprometido(a)... ${emojis.corno}`);
    }

    // CORNO 2: beijaram seu parceiro
    if (parceiroDoAlvo === autor.id && usuario.id !== autor.id) {
      try {
        const user = await client.users.fetch(autor.id);
        await user.send({
          content: `${emojis.alerta} **ALERTA DE TRAIÇÃO!** ${emojis.alerta}\n\n${emojis.corno} Seu parceiro(a) **${usuario.username}** recebeu e retribuiu um beijo de **${autor.username}**!\n${emojis.coracao} A confiança está sendo colocada à prova.`
        });
      } catch (err) {
        console.error(`❌ Erro ao enviar DM para ${autor.id}:`, err.message);
      }
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
        return i.reply({ content: `${emojis.alerta} Apenas ${usuario} pode retribuir esse beijo!`, ephemeral: true });
      }

      let novoGif;
      try {
        const response = await fetch('https://api.waifu.pics/sfw/kiss');
        const data = await response.json();
        novoGif = data.url;
      } catch (error) {
        return i.reply({ content: `${emojis.alerta} Erro ao buscar novo gif.`, ephemeral: true });
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
        try {
          const user = await client.users.fetch(parceiroDoAlvo);
          await user.send({
            content: `${emojis.alerta} **TRAIÇÃO CONFIRMADA!** ${emojis.alerta}\n\n${emojis.corno} Seu parceiro(a) **${usuario.username}** retribuiu um beijo de **${autor.username}**!\n${emojis.coracao} A confiança está sendo colocada à prova.`
          });
        } catch (err) {
          console.error(`❌ Erro ao enviar DM para ${parceiroDoAlvo}:`, err.message);
        }
        retribuirEmbed.setDescription(retribuirEmbed.data.description + `\n\n${emojis.alerta} **${usuario.username}** parece estar comprometido(a)... ${emojis.corno}`);
      }

      await i.update({ embeds: [retribuirEmbed], components: [] });
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        message.edit({ components: [] }).catch(console.error);
      }
    });
  }
};