import {
  EmbedBuilder,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  type Interaction,
} from 'discord.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';

export function inventoryDescription(items: readonly { name: string; quantity: number }[]): string {
  if (items.length === 0) return 'O inventário está vazio.';
  const lines: string[] = [];
  let length = 0;
  for (const item of items) {
    const line = `**${item.name}** × ${String(item.quantity)}`;
    if (length + line.length + 1 > 4050) {
      lines.push(`… e mais ${String(items.length - lines.length)} nesta lista.`);
      break;
    }
    lines.push(line);
    length += line.length + 1;
  }
  return lines.join('\n');
}

export async function execute(interaction: Interaction, client: WardizittoClient): Promise<void> {
  if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;
  const { customId, user } = interaction;
  const economy = client.services.economy;

  if (interaction.isButton() && customId === 'atm_manage') {
    const modal = new ModalBuilder().setCustomId('modal_atm').setTitle('🏦 Banco Wardizitto');
    modal.addLabelComponents(
      new LabelBuilder()
        .setLabel('Digite depositar ou sacar')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('atm_action')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(10)
            .setRequired(true),
        ),
      new LabelBuilder()
        .setLabel('Valor ou "tudo"')
        .setTextInputComponent(
          new TextInputBuilder()
            .setCustomId('atm_val')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(30)
            .setRequired(true),
        ),
    );
    await interaction.showModal(modal);
    return;
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
    if (!direction) {
      await interaction.editReply('❌ Use “depositar” ou “sacar”.');
      return;
    }

    const amount =
      rawAmount === 'tudo' ? 'all' : /^\d{1,20}$/u.test(rawAmount) ? BigInt(rawAmount) : 0n;
    const balance = await economy.moveFunds(user.id, amount, direction, interaction.id);
    await interaction.editReply(
      `✅ Operação concluída. Carteira: **${balance.wallet.toLocaleString('pt-BR')}** · Banco: **${balance.bank.toLocaleString('pt-BR')}**`,
    );
    return;
  }

  if (interaction.isStringSelectMenu() && customId === 'buy_item_select') {
    if (!interaction.guildId) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const itemId = Number(interaction.values[0]);
    const purchase = await economy.purchaseItem(
      user.id,
      interaction.guildId,
      itemId,
      interaction.id,
    );
    await interaction.editReply(
      `✅ **${purchase.itemName}** comprado. Saldo: **${purchase.balance.wallet.toLocaleString('pt-BR')}**.`,
    );
    return;
  }

  if (!interaction.isButton()) return;
  const match = /^(inventory|badges)_(\d{17,20})$/u.exec(customId);
  if (!match?.[2]) return;
  const [, type, targetId] = match;
  if (type === 'inventory') {
    if (!interaction.guildId) return;
    const items = await economy.inventory(targetId, interaction.guildId);
    const embed = new EmbedBuilder()
      .setTitle('🎒 Inventário')
      .setColor('#9b59b6')
      .setDescription(inventoryDescription(items));
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    return;
  }

  const account = await economy.getAccount(targetId);
  const badges = [];
  if (account.level >= 10) badges.push('⭐ **Veterano**: nível 10+');
  if (account.wallet + account.bank >= 1_000_000n) badges.push('💎 **Milionário**: patrimônio 1M+');
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🏅 Insígnias')
        .setColor('#f1c40f')
        .setDescription(badges.join('\n') || 'Nenhuma insígnia conquistada.'),
    ],
    flags: MessageFlags.Ephemeral,
  });
}
