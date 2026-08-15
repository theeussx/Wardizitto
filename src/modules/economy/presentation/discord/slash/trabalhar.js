const {
  SlashCommandBuilder,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trabalhar')
    .setDescription('💼 Trabalhe para ganhar Wardcoins e XP.'),

  async execute(interaction) {
    const reward = BigInt(Math.floor(Math.random() * 300) + 200);
    const xpGain = Math.floor(Math.random() * 30) + 20;
    await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
    const result = await interaction.client.services.economy.claimWork(
      interaction.user.id,
      reward,
      xpGain,
      60 * 60 * 1000,
    );
    const container = new ContainerBuilder();
    if (!result.available) {
      const minutes = Math.max(1, Math.ceil(result.retryAfterMs / 60_000));
      container
        .setAccentColor(0xed4245)
        .addTextDisplayComponents((text) =>
          text.setContent(`## ⏳ Descanse um pouco\nVolte em **${minutes} minutos**.`),
        );
    } else {
      container
        .setAccentColor(0x3498db)
        .addTextDisplayComponents((text) => text.setContent('## 💼 Trabalho concluído'))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents((text) =>
          text.setContent(
            `Salário: **${reward.toLocaleString('pt-BR')} Wardcoins**\nXP: **+${result.value.xpGain}**\nSaldo: **${result.value.balance.wallet.toLocaleString('pt-BR')}**`,
          ),
        );
    }
    await interaction.editReply({ components: [container] });
  },
};
