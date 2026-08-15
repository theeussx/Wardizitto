const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { LabelBuilder, emoji } = require('../../../../../presentation/discord/ui/components-v2.js');

const emojis = {
  slap: '🥊',
  retribuir: emoji('eg_fire'),
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

    const label = new LabelBuilder()
      .setTitle(`${emojis.slap} Tapa!`)
      .setAuthor(interaction.user.username, interaction.user.displayAvatarURL({ dynamic: true }))
      .setDescription(`**${interaction.user}** deu um tapa em **${usuario}**! ${emojis.slap}`)
      .setImage(data.url)
      .setColor('#FF4500')
      .setFooter('Tapa enviado com força!')
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('revidar_tapa')
        .setLabel('Revidar Tapa')
        .setEmoji(emojis.retribuir)
        .setStyle(ButtonStyle.Danger),
    );

    const message = await interaction.editReply({
      components: [label.build(), row],
      flags: MessageFlags.IsComponentsV2,
    });

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

      const returnLabel = new LabelBuilder()
        .setTitle(`${emojis.slap} Revanche!`)
        .setDescription(
          `**${usuario}** revidou e deu um tapa em **${interaction.user}**! ${emojis.slap}`,
        )
        .setImage(revanche.url)
        .setColor('#FF6347')
        .setFooter('Toma essa de volta!')
        .setTimestamp();

      await i.update({
        components: [returnLabel.build()],
        flags: MessageFlags.IsComponentsV2,
      });
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        // Remove o botão sem apagar o conteúdo do rótulo.
        message.edit({
          components: [label.build()],
          flags: MessageFlags.IsComponentsV2,
        });
      }
    });
  },
};
