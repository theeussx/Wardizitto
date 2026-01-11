const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const db = require('../../handlers/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('escolher-profissao')
    .setDescription('Escolha sua profissão para ganhar Wardcoins!'),

  async execute(interaction) {
    const userId = interaction.user.id;

    // Emojis personalizados
    const emojis = {
      tools: '<:icons_tools:1353597168912437341>',
      wrong: '<:icons_wrong:1353597190920212573>',
      loading: '<a:loading:1353898628149940326>',
      star: '<:icons_star:1353597390673936448>',
      logo: '<a:icons_logo:1353597304170483795>',
    };

    // Mensagem de loading (efêmera)
    await interaction.reply({ content: `${emojis.loading} Carregando menu de profissões...`, flags: MessageFlags.Ephemeral });

    try {
      // Criar banner
      const canvas = createCanvas(600, 200);
      const ctx = canvas.getContext('2d');

      // Fundo
      ctx.fillStyle = '#00BFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Carregar avatar
      const avatar = await loadImage(interaction.user.displayAvatarURL({ extension: 'png', size: 128 }));
      ctx.save();
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true); // Círculo para avatar (80x80)
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 20, 20, 80, 80); // Desenha avatar
      ctx.restore();

      // Adicionar borda ao avatar
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(60, 60, 40, 0, Math.PI * 2, true);
      ctx.stroke();

      // Texto
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px Arial';
      ctx.fillText('Escolha sua Profissão', 120, 50);
      ctx.font = '20px Arial';
      ctx.fillText('Selecione no menu abaixo', 120, 90);

      const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'profissao-banner.png' });

      // Criar menu
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('selecionar_profissao')
          .setPlaceholder('Selecione sua profissão')
          .addOptions([
            { label: 'Programador', value: 'Programador', description: 'Cria códigos incríveis!' },
            { label: 'Mecânico', value: 'Mecânico', description: 'Conserta tudo com maestria!' },
            { label: 'Designer', value: 'Designer', description: 'Transforma ideias em arte!' },
            { label: 'Streamer', value: 'Streamer', description: 'Entretenimento ao vivo!' },
            { label: 'Músico', value: 'Músico', description: 'Encanta com melodias!' },
          ])
      );

      // Criar embed
      const embed = new EmbedBuilder()
        .setTitle(`${emojis.tools} Escolher Profissão`)
        .setDescription('Selecione uma profissão para começar a ganhar Wardcoins!')
        .setColor('#00BFFF')
        .addFields({
          name: `${emojis.star} Instruções`,
          value: 'Use o menu abaixo para escolher sua profissão.',
          inline: false,
        })
        .setImage('attachment://profissao-banner.png')
        .setFooter({ text: 'Sistema de economia Wardcoins', iconURL: `https://cdn.discordapp.com/emojis/${emojis.logo.split(':')[2].replace('>', '')}.gif` })
        .setTimestamp();

      await interaction.editReply({
        content: null,
        embeds: [embed],
        components: [row],
        files: [attachment],
        flags: MessageFlags.Ephemeral,
      });

    } catch (err) {
      console.error('Erro ao executar o comando /escolher-profissao:', err);
      const embedErro = new EmbedBuilder()
        .setTitle(`${emojis.wrong} Erro`)
        .setDescription('Ocorreu um erro ao carregar o menu de profissões. Tente novamente mais tarde.')
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