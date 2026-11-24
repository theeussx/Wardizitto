import {
  SlashCommandBuilder,
  ContainerBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
  SeparatorBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';

export const data = new SlashCommandBuilder()
  .setName('perfil')
  .setDescription('✨ Veja suas informações personalizadas e conquistas.')
  .addUserOption((option) =>
    option.setName('usuario').setDescription('Selecione um usuário para visualizar.'),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: WardizittoClient,
): Promise<void> {
  const target = interaction.options.getUser('usuario') ?? interaction.user;
  const userId = target.id;
  const isOwnProfile = target.id === interaction.user.id;

  await interaction.deferReply(isOwnProfile ? {} : { flags: MessageFlags.Ephemeral });

  const data = await client.services.economy.findProfile(userId);
  if (!data) {
    await interaction.editReply({
      content: '❌ Este usuário ainda não possui uma conta no sistema de economia.',
    });
    return;
  }

  const level = data.level;
  const xp = data.xp;
  const xpNecessario = level * 500;
  const progresso = Math.min(Math.floor((xp / xpNecessario) * 10), 10);
  const barraXP = '▰'.repeat(progresso) + '▱'.repeat(10 - progresso);

  const carteira = data.wallet;
  const banco = data.bank;
  const saldoTotal = (carteira + banco).toLocaleString('pt-BR');

  const profileContainer = new ContainerBuilder()
    .setAccentColor(0x5865f2)
    .addTextDisplayComponents((t) =>
      t.setContent(
        `## 👤 Perfil: ${target.username}\n> ${data.about || "Este usuário ainda não definiu um 'sobre mim'."}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents((t) =>
      t.setContent(
        `### ⭐ Status\n**Nível:** \`${String(level)}\` | **Profissão:** \`${data.profession ?? 'Desempregado'}\`\n**XP:** \`${String(xp)} / ${String(xpNecessario)}\`\n${barraXP}`,
      ),
    )
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents((t) =>
      t.setContent(
        `### 🪙 Economia\n**Carteira:** \`${carteira.toLocaleString('pt-BR')}\` 🪙\n**Banco:** \`${banco.toLocaleString('pt-BR')}\` 🏦\n**Patrimônio:** ⭐ **${saldoTotal}** Wardcoins`,
      ),
    );

  if (isOwnProfile) {
    profileContainer.addSeparatorComponents(new SeparatorBuilder());
    profileContainer.addSectionComponents((s) =>
      s
        .addTextDisplayComponents((t) =>
          t.setContent('**Banco Wardizitto**\nGerencie seu saldo bancário com segurança.'),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId('atm_manage')
            .setLabel('Acessar ATM')
            .setStyle(ButtonStyle.Success),
        ),
    );
  }

  const rowUtils = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`inventory_${userId}`)
      .setLabel('Inventário')
      .setEmoji('🎒')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`badges_${userId}`)
      .setLabel('Insígnias')
      .setEmoji('🏅')
      .setStyle(ButtonStyle.Success),
  );

  await interaction.editReply({
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
    components: [profileContainer, rowUtils],
  });
}
