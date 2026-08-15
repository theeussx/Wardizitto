const {
  ContainerBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
  SeparatorBuilder,
} = require('discord.js');

module.exports = {
  name: 'adivinhar',
  description: 'Tente adivinhar o número que estou pensando de 1 a 10!',
  category: 'diversao',
  run: async (client, message, args) => {
    const numeroPensado = Math.floor(Math.random() * 10) + 1;

    const gameContainer = new ContainerBuilder()
      .setAccentColor(0x5865f2)
      .addTextDisplayComponents((t) =>
        t.setContent(
          '## 🎲 Jogo da Adivinhação\n> Eu pensei em um número entre **1 e 10**. Você tem apenas **uma chance** para acertar!',
        ),
      )
      .addSeparatorComponents(new SeparatorBuilder());

    const row1 = new ActionRowBuilder();
    const row2 = new ActionRowBuilder();

    for (let n = 1; n <= 10; n++) {
      const btn = new ButtonBuilder()
        .setCustomId(`guess_${n}`)
        .setLabel(`${n}`)
        .setStyle(ButtonStyle.Secondary);

      if (n <= 5) row1.addComponents(btn);
      else row2.addComponents(btn);
    }

    const msg = await message.reply({
      components: [gameContainer, row1, row2],
      flags: [MessageFlags.IsComponentsV2],
    });

    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.user.id === message.author.id,
      time: 15000,
      max: 1,
    });

    collector.on('collect', async (i) => {
      const escolha = parseInt(i.customId.split('_')[1]);
      const acertou = escolha === numeroPensado;

      const resultContainer = new ContainerBuilder()
        .setAccentColor(acertou ? 0x57f287 : 0xed4245)
        .addTextDisplayComponents((t) =>
          t.setContent(
            acertou
              ? `### 🎉 Parabéns! Você acertou!\n> O número que eu pensei era realmente o **${numeroPensado}**.`
              : `### ❌ Que pena! Você errou.\n> Você escolheu **${escolha}**, mas o número correto era **${numeroPensado}**.`,
          ),
        );

      await i.update({
        components: [resultContainer],
        flags: [MessageFlags.IsComponentsV2],
      });
    });

    collector.on('end', (collected, reason) => {
      if (reason === 'time' && collected.size === 0) {
        const timeoutContainer = new ContainerBuilder()
          .setAccentColor(0x2f3136)
          .addTextDisplayComponents((t) =>
            t.setContent(
              '### ⏰ Tempo Esgotado!\n> Você demorou muito para responder. O jogo foi cancelado.',
            ),
          );

        msg.edit({ components: [timeoutContainer] }).catch(() => {});
      }
    });
  },
};
