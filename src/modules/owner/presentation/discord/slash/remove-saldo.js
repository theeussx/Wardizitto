const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isOwner } = require('../../../../../core/security/owner.js');
const { LabelBuilder, Colors } = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remover-saldo')
    .setDescription('Remove Wardcoins da carteira ou banco de um usuário.')
    .addUserOption((option) =>
      option.setName('usuario').setDescription('Usuário de destino.').setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName('quantidade')
        .setDescription('Quantidade a remover.')
        .setRequired(true)
        .setMinValue(1),
    )
    .addStringOption((option) =>
      option
        .setName('origem')
        .setDescription('Saldo de origem.')
        .setRequired(true)
        .addChoices({ name: 'Carteira', value: 'wallet' }, { name: 'Banco', value: 'bank' }),
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Acesso negado.', flags: MessageFlags.Ephemeral });
    }
    const target = interaction.options.getUser('usuario', true);
    const amount = BigInt(interaction.options.getInteger('quantidade', true));
    const source = interaction.options.getString('origem', true);
    const balance = await interaction.client.services.economy.changeBalance(
      target.id,
      -amount,
      source,
    );
    interaction.client.services.logger.audit('Saldo administrativo removido.', {
      actorId: interaction.user.id,
      targetId: target.id,
      amount: amount.toString(),
      source,
    });

    const label = new LabelBuilder()
      .setColor(Colors.Orange)
      .setTitle('Saldo removido')
      .setDescription(
        `Foram removidos **${amount.toLocaleString('pt-BR')} Wardcoins** de ${target}.`,
      )
      .addField('Carteira', balance.wallet.toLocaleString('pt-BR'), true)
      .addField('Banco', balance.bank.toLocaleString('pt-BR'), true)
      .setTimestamp();

    return interaction.reply({
      components: [label.build()],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};
