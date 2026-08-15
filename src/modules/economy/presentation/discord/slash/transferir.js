const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('transferir')
    .setDescription('Transfira Wardcoins para outro usuário.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Destinatário.').setRequired(true),
    )
    .addIntegerOption((option) =>
      option.setName('quantia').setDescription('Valor.').setRequired(true).setMinValue(1),
    ),

  async execute(interaction) {
    const receiver = interaction.options.getUser('usuario', true);
    const amount = BigInt(interaction.options.getInteger('quantia', true));
    if (receiver.bot || receiver.id === interaction.user.id) {
      return interaction.reply({
        content: '❌ Escolha outro usuário que não seja um bot.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_transfer')
        .setLabel('Confirmar')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('cancel_transfer')
        .setLabel('Cancelar')
        .setStyle(ButtonStyle.Danger),
    );
    const response = await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('Yellow')
          .setTitle('Confirmar transferência')
          .setDescription(
            `Transferir **${amount.toLocaleString('pt-BR')} Wardcoins** para ${receiver}?`,
          ),
      ],
      components: [row],
      withResponse: true,
    });

    const message = response.resource?.message;
    if (!message) throw new Error('Mensagem de confirmação não foi criada.');
    const confirmation = await message
      .awaitMessageComponent({
        componentType: ComponentType.Button,
        filter: (button) => button.user.id === interaction.user.id,
        time: 30_000,
      })
      .catch(() => undefined);
    if (!confirmation || confirmation.customId === 'cancel_transfer') {
      await interaction.editReply({
        content: 'Transferência cancelada.',
        embeds: [],
        components: [],
      });
      return;
    }

    await confirmation.deferUpdate();
    const balance = await interaction.client.services.economy.transfer(
      interaction.user.id,
      receiver.id,
      amount,
      interaction.guildId,
      interaction.id,
    );
    await interaction.editReply({
      content: `✅ Transferência concluída. Saldo: **${balance.wallet.toLocaleString('pt-BR')}** Wardcoins.`,
      embeds: [],
      components: [],
    });
  },
};
