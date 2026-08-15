const { MessageFlags, TextInputStyle } = require('discord.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');
const {
  LabelBuilder,
  Colors,
  createModal,
} = require('../../../../../presentation/discord/ui/components-v2.js');

module.exports = {
  async execute(interaction) {
    const { customId, user } = interaction;
    const economy = interaction.client.services.economy;

    if (interaction.isButton() && customId === 'atm_manage') {
      const modal = createModal({
        customId: 'modal_atm',
        title: '🏦 Banco Wardizitto',
        fields: [
          {
            customId: 'atm_action',
            label: 'Digite depositar ou sacar',
            style: TextInputStyle.Short,
            maxLength: 10,
            required: true,
          },
          {
            customId: 'atm_val',
            label: 'Valor ou "tudo"',
            style: TextInputStyle.Short,
            maxLength: 30,
            required: true,
          },
        ],
      });
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && customId === 'modal_atm') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const action = interaction.fields.getTextInputValue('atm_action').trim().toLowerCase();
      const rawAmount = interaction.fields.getTextInputValue('atm_val').trim().toLowerCase();
      const direction = action.startsWith('depo')
        ? 'deposit'
        : action.startsWith('sac')
          ? 'withdraw'
          : undefined;
      if (!direction) return interaction.editReply('❌ Use “depositar” ou “sacar”.');

      const account = await economy.getAccount(user.id);
      const amount =
        rawAmount === 'tudo'
          ? direction === 'deposit'
            ? account.wallet
            : account.bank
          : /^\d{1,20}$/.test(rawAmount)
            ? BigInt(rawAmount)
            : 0n;
      const balance = await economy.moveFunds(user.id, amount, direction);
      return interaction.editReply(
        `✅ Operação concluída. Carteira: **${balance.wallet.toLocaleString('pt-BR')}** · Banco: **${balance.bank.toLocaleString('pt-BR')}**`,
      );
    }

    if (interaction.isStringSelectMenu() && customId === 'buy_item_select') {
      if (!interaction.guildId) return;
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const itemId = Number(interaction.values[0]);
      const purchase = await economy.purchaseItem(user.id, interaction.guildId, itemId);
      return interaction.editReply(
        `✅ **${purchase.itemName}** comprado. Saldo: **${purchase.balance.wallet.toLocaleString('pt-BR')}**.`,
      );
    }

    if (!interaction.isButton()) return;
    const match = customId.match(/^(inventory|badges)_(\d{17,20})$/);
    if (!match) return;
    const [, type, targetId] = match;
    if (type === 'inventory') {
      const items = await query(
        `SELECT l.item_nome, i.quantidade
           FROM economia_inventario i
           JOIN economia_loja l ON i.item_id = l.id
          WHERE i.user_id = ? AND i.guild_id = ?
          ORDER BY l.item_nome LIMIT 50`,
        [targetId, interaction.guildId],
      );
      const label = new LabelBuilder()
        .setTitle('🎒 Inventário')
        .setColor(Colors.Purple)
        .setDescription(
          items.length
            ? items.map((item) => `**${item.item_nome}** × ${item.quantidade}`).join('\n')
            : 'O inventário está vazio.',
        );
      return interaction.reply({
        components: [label.build()],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const account = await economy.getAccount(targetId);
    const badges = [];
    if (account.level >= 10) badges.push('⭐ **Veterano**: nível 10+');
    if (account.wallet + account.bank >= 1_000_000n)
      badges.push('💎 **Milionário**: patrimônio 1M+');
    const badgeLabel = new LabelBuilder()
      .setTitle('🏅 Insígnias')
      .setColor('#f1c40f')
      .setDescription(badges.join('\n') || 'Nenhuma insígnia conquistada.');
    return interaction.reply({
      components: [badgeLabel.build()],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};
