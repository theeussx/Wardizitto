const {
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');
const { query } = require('../../../../../infrastructure/database/legacy.js');

module.exports = {
  async execute(interaction) {
    const { customId, user } = interaction;
    const economy = interaction.client.services.economy;

    if (interaction.isButton() && customId === 'atm_manage') {
      const modal = new ModalBuilder().setCustomId('modal_atm').setTitle('🏦 Banco Wardizitto');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('atm_action')
            .setLabel('Digite depositar ou sacar')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(10)
            .setRequired(true),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('atm_val')
            .setLabel('Valor ou "tudo"')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(30)
            .setRequired(true),
        ),
      );
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
      const embed = new EmbedBuilder()
        .setTitle('🎒 Inventário')
        .setColor('#9b59b6')
        .setDescription(
          items.length
            ? items.map((item) => `**${item.item_nome}** × ${item.quantidade}`).join('\n')
            : 'O inventário está vazio.',
        );
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    const account = await economy.getAccount(targetId);
    const badges = [];
    if (account.level >= 10) badges.push('⭐ **Veterano**: nível 10+');
    if (account.wallet + account.bank >= 1_000_000n)
      badges.push('💎 **Milionário**: patrimônio 1M+');
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🏅 Insígnias')
          .setColor('#f1c40f')
          .setDescription(badges.join('\n') || 'Nenhuma insígnia conquistada.'),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
