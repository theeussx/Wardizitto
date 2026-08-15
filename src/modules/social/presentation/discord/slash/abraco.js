const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { LabelBuilder, emoji } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('abraço')
    .setDescription('Dê um abraço em alguém!')
    .addUserOption((option) =>
      option
        .setName('usuario')
        .setDescription('「Social」O usuário que você quer abraçar')
        .setRequired(true),
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
        const res = await fetch('https://api.waifu.pics/sfw/hug', {
          signal: AbortSignal.timeout(interaction.client.services.config.HTTP_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error('waifu.pics fora do ar');
        const json = await res.json();
        return json.url;
      } catch {
        const res = await fetch('https://api.waifu.im/sfw/hug', {
          headers: { 'Accept-Version': 'v6' },
          signal: AbortSignal.timeout(interaction.client.services.config.HTTP_TIMEOUT_MS),
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

    const label = new LabelBuilder()
      .setTitle(`${emoji('eg_heart')} Abraço Recebido!`)
      .setDescription(`${interaction.user} deu um abraço em ${user}! ${emoji('eg_heart')}`)
      .setImage(imagem)
      .setColor('#FFC0CB')
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('retribuir_abraço')
      .setLabel('Retribuir Abraço')
      .setEmoji(emoji('icons_heart'))
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    const message = await interaction.editReply({
      components: [label.build(), row],
      flags: MessageFlags.IsComponentsV2,
    });

    const filter = (i) => i.customId === 'retribuir_abraço' && i.message.id === message.id;
    const collector = message.createMessageComponentCollector({ filter, time: 30000, max: 1 });

    collector.on('collect', async (i) => {
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

      const returnLabel = new LabelBuilder()
        .setTitle(`${emoji('eg_heart')} Retribuição de Abraço`)
        .setDescription(`${user} retribuiu o abraço de ${interaction.user}! ${emoji('eg_heart')}`)
        .setImage(novaImagem)
        .setColor('#FF69B4')
        .setTimestamp();

      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(button).setDisabled(true),
      );

      await i.update({
        components: [returnLabel.build(), disabledRow],
        flags: MessageFlags.IsComponentsV2,
      });
    });

    collector.on('end', (collected) => {
      if (collected.size === 0 && !message.deleted) {
        const disabledRow = new ActionRowBuilder().addComponents(
          ButtonBuilder.from(button).setDisabled(true),
        );
        message
          .edit({
            components: [label.build(), disabledRow],
            flags: MessageFlags.IsComponentsV2,
          })
          .catch(() => {});
      }
    });
  },
};
