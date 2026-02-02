const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

// Emojis personalizados
const emojis = {
  heart: '<:eg_heart:1353597127091294208>',
  retribuir: '<:icons_heart:1353597437922775082>',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('abraço')
    .setDescription('Dê um abraço em alguém!')
    .addUserOption(option =>
      option.setName('usuario')
        .setDescription('「Social」O usuário que você quer abraçar')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const user = interaction.options.getUser('usuario');
    if (user.bot) {
      return interaction.editReply({
        content: '🤖 Você não pode abraçar bots!',
      });
    }

    // Função para buscar imagem (com fallback automático)
    async function buscarImagemAbraço() {
      try {
        const res = await fetch('https://api.waifu.pics/sfw/hug');
        if (!res.ok) throw new Error('waifu.pics fora do ar');
        const json = await res.json();
        return json.url;
      } catch {
        const res = await fetch('https://api.waifu.im/sfw/hug', {
          headers: { 'Accept-Version': 'v6' },
        });
        const json = await res.json();
        return json.images[0].url;
      }
    }

    // Buscar imagem principal
    let imagem;
    try {
      imagem = await buscarImagemAbraço();
    } catch {
      return interaction.editReply({
        content: '❌ Não consegui buscar a imagem do abraço agora. Tente mais tarde.',
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.heart} Abraço Recebido!`)
      .setDescription(`${interaction.user} deu um abraço em ${user}! ${emojis.heart}`)
      .setImage(imagem)
      .setColor('#FFC0CB')
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('retribuir_abraço')
      .setLabel('Retribuir Abraço')
      .setEmoji(emojis.retribuir)
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const message = await interaction.editReply({ embeds: [embed], components: [row] });

    const filter = i => i.customId === 'retribuir_abraço' && i.message.id === message.id;
    const collector = message.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async i => {
      if (i.user.id !== user.id) {
        return i.reply({
          content: `⛔ Apenas ${user} pode retribuir esse abraço!`,
          ephemeral: true,
        });
      }

      let novaImagem;
      try {
        novaImagem = await buscarImagemAbraço();
      } catch {
        return i.reply({
          content: '❌ Não consegui carregar a imagem para retribuir o abraço.',
          ephemeral: true,
        });
      }

      const returnEmbed = new EmbedBuilder()
        .setTitle(`${emojis.heart} Retribuição de Abraço`)
        .setDescription(`${user} retribuiu o abraço de ${interaction.user}! ${emojis.heart}`)
        .setImage(novaImagem)
        .setColor('#FF69B4')
        .setTimestamp();

      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(button).setDisabled(true)
      );

      await i.update({ embeds: [returnEmbed], components: [disabledRow] });
    });

    collector.on('end', collected => {
      if (collected.size === 0 && !message.deleted) {
        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(button).setDisabled(true)
        );
        message.edit({ components: [disabledRow] }).catch(() => {});
      }
    });
  },
};