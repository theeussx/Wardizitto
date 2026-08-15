const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isOwner } = require('../../../../../core/security/owner.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-saldo')
    .setDescription('Adiciona Wardcoins à carteira de um usuário.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Usuário de destino.').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('quantidade')
        .setDescription('Quantidade a adicionar.')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1_000_000),
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Acesso negado.', flags: MessageFlags.Ephemeral });
    }
    const target = interaction.options.getUser('usuario', true);
    const amount = BigInt(interaction.options.getInteger('quantidade', true));
    const balance = await interaction.client.services.economy.changeBalance(
      target.id,
      amount,
      'wallet',
    );
    interaction.client.services.logger.audit('Saldo administrativo adicionado.', {
      actorId: interaction.user.id,
      targetId: target.id,
      amount: amount.toString(),
    });

    const label = new LabelBuilder()
      .setColor(Colors.Green)
      .setTitle('Saldo adicionado')
      .setDescription(
        `Foram adicionados **${amount.toLocaleString('pt-BR')} Wardcoins** a ${target}.`,
      )
      .addField('Novo saldo da carteira', balance.wallet.toLocaleString('pt-BR'))
      .setTimestamp();

    return interaction.reply({
      components: [label.build()],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};
