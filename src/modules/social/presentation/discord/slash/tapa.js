const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const emojiIds = require('../../../../../core/config/emojis.json').static;

const emojis = {
  slap: '🥊',
  retribuir: `<:eg_fire:${emojiIds.eg_fire}>`,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tapa')
    .setDescription('Dê um tapa em alguém!')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('「Social」O usuário que você quer dar um tapa')
        .setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const usuario = interaction.options.getUser('usuario');
    if (usuario.bot) return interaction.editReply({ content: '🤖 Você não pode bater em bots!' });

    const response = await fetch('https://api.waifu.pics/sfw/slap', {
      signal: AbortSignal.timeout(interaction.client.services.config.HTTP_TIMEOUT_MS),
    });
    const data = await response.json();

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.slap} Tapa!`)
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
      })
      .setDescription(`**${interaction.user}** deu um tapa em **${usuario}**! ${emojis.slap}`)
      .setImage(data.url)
      .setColor('#FF4500')
      .setFooter({ text: 'Tapa enviado com força!' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('revidar_tapa')
        .setLabel('Revidar Tapa')
        .setEmoji(emojiIds.eg_fire)
        .setStyle(ButtonStyle.Danger),
    );

    const message = await interaction.editReply({ embeds: [embed], components: [row] });

    const filter = (i) => i.customId === 'revidar_tapa';
    const collector = message.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async (i) => {
      if (i.user.id !== usuario.id) {
        return i.reply({
          content: `⛔ Apenas ${usuario} pode revidar esse tapa!`,
          ephemeral: true,
        });
      }

      const revanche = await fetch('https://api.waifu.pics/sfw/slap', {
        signal: AbortSignal.timeout(interaction.client.services.config.HTTP_TIMEOUT_MS),
      }).then((res) => res.json());

      const returnEmbed = new EmbedBuilder()
        .setTitle(`${emojis.slap} Revanche!`)
        .setDescription(
          `**${usuario}** revidou e deu um tapa em **${interaction.user}**! ${emojis.slap}`,
        )
        .setImage(revanche.url)
        .setColor('#FF6347')
        .setFooter({ text: 'Toma essa de volta!' })
        .setTimestamp();

      await i.update({ embeds: [returnEmbed], components: [] });
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        message.edit({ components: [] }); // Remove botão se ninguém revidar
      }
    });
  },
};
