const {
  SlashCommandBuilder,
  ContainerBuilder,
  SeparatorBuilder,
  MessageFlags,
} = require('discord.js');

const formatDuration = (milliseconds) => {
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.ceil((milliseconds % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('📅 Resgate sua recompensa diária de Wardcoins.'),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
    const reward = 1_500n;
    const result = await interaction.client.services.economy.claimDaily(
      interaction.user.id,
      reward,
      24 * 60 * 60 * 1000,
    );
    const container = new ContainerBuilder();
    if (!result.available) {
      container
        .setAccentColor(0xed4245)
        .addTextDisplayComponents((text) =>
          text.setContent(
            `## ⏳ Recompensa indisponível\nVolte em **${formatDuration(result.retryAfterMs)}**.`,
          ),
        );
    } else {
      container
        .setAccentColor(0x9b59b6)
        .addTextDisplayComponents((text) => text.setContent('## 📅 Recompensa diária'))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents((text) =>
          text.setContent(
            `Você recebeu **${reward.toLocaleString('pt-BR')} Wardcoins**.\nSaldo: **${result.value.wallet.toLocaleString('pt-BR')}**`,
          ),
        );
    }
    await interaction.editReply({ components: [container] });
  },
};
