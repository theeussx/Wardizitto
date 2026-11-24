import {
  AutoModerationActionType as Action,
  AutoModerationRuleEventType as Event,
  AutoModerationRuleTriggerType as Trigger,
  ContainerBuilder,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextDisplayBuilder,
  type AutoModerationRule,
  type ChatInputCommandInteraction,
  type SlashCommandSubcommandBuilder,
} from 'discord.js';

import { discordTheme } from '../../../../../core/design/discord-theme.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';

const permission = PermissionFlagsBits.ManageGuild;
const names = {
  [Trigger.Spam]: 'Wardizitto · Spam',
  [Trigger.MentionSpam]: 'Wardizitto · Mentions',
} as const;
type SupportedTrigger = keyof typeof names;

function enabledOption(sub: SlashCommandSubcommandBuilder) {
  return sub.addBooleanOption((opt) =>
    opt
      .setName('ativo')
      .setNameLocalization('en-US', 'enabled')
      .setDescription('Ativa ou desativa o bloqueio de mensagens.')
      .setDescriptionLocalization('en-US', 'Enable or disable message blocking.')
      .setRequired(true),
  );
}

export const data = new SlashCommandBuilder()
  .setName('automod')
  .setDescription('Gerencia o AutoMod nativo deste servidor.')
  .setDescriptionLocalization('en-US', 'Manage native AutoMod for this server.')
  .setContexts(InteractionContextType.Guild)
  .setDefaultMemberPermissions(permission)
  .addSubcommand((sub) =>
    sub
      .setName('status')
      .setDescription('Consulta as regras de spam e menções.')
      .setDescriptionLocalization('en-US', 'Show spam and mention rules.'),
  )
  .addSubcommand((sub) =>
    enabledOption(
      sub
        .setName('spam')
        .setDescription('Configura o bloqueio de spam do Discord.')
        .setDescriptionLocalization('en-US', 'Configure Discord spam blocking.'),
    ),
  )
  .addSubcommand((sub) =>
    enabledOption(
      sub
        .setName('mencoes')
        .setNameLocalization('en-US', 'mentions')
        .setDescription('Configura o limite de menções por mensagem.')
        .setDescriptionLocalization('en-US', 'Configure the mention limit per message.'),
    ).addIntegerOption((opt) =>
      opt
        .setName('limite')
        .setNameLocalization('en-US', 'limit')
        .setDescription('Menções únicas permitidas por mensagem (padrão inicial de 5).')
        .setDescriptionLocalization(
          'en-US',
          'Unique mentions allowed per message (initial default of 5).',
        )
        .setMinValue(1)
        .setMaxValue(50),
    ),
  );
export const access = { guildOnly: true, guildPermissions: [permission] } as const;

const translations = {
  pt: {
    denied: 'Você e o Wardizitto precisam da permissão Gerenciar Servidor.',
    title: 'AutoMod do servidor',
    spam: 'Spam',
    mentions: 'Menções',
    limit: 'Limite por mensagem',
    absent: 'Sem regra',
    active: 'Ativa',
    inactive: 'Inativa',
    external: 'Gerenciada fora deste comando',
    conflict:
      'O Discord permite uma regra deste tipo por servidor. Gerencie a regra existente nas configurações de AutoMod do Discord.',
    unchanged: 'A configuração solicitada já está aplicada.',
    saved: 'Configuração salva.',
    changed: 'As regras foram alteradas durante a operação. Consulte /automod status.',
    invalid: 'Escolha um limite inteiro de 1 a 50.',
  },
  en: {
    denied: 'You and Wardizitto both need the Manage Server permission.',
    title: 'Server AutoMod',
    spam: 'Spam',
    mentions: 'Mentions',
    limit: 'Limit per message',
    absent: 'No rule',
    active: 'Enabled',
    inactive: 'Disabled',
    external: 'Managed outside this command',
    conflict:
      'Discord allows one rule of this type per server. Manage the existing rule in Discord AutoMod settings.',
    unchanged: 'The requested settings are already in effect.',
    saved: 'Settings saved.',
    changed: 'The rules changed during this operation. Check /automod status.',
    invalid: 'Choose a whole number from 1 to 50.',
  },
} as const;

function owned(
  rule: AutoModerationRule,
  trigger: SupportedTrigger,
  guildId: string,
  botId: string,
): boolean {
  return (
    rule.guild.id === guildId &&
    rule.creatorId === botId &&
    rule.triggerType === trigger &&
    rule.name === names[trigger] &&
    rule.eventType === Event.MessageSend &&
    rule.actions.length === 1 &&
    rule.actions[0]?.type === Action.BlockMessage
  );
}

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: WardizittoClient,
): Promise<void> {
  const t = interaction.locale.startsWith('en') ? translations.en : translations.pt;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!interaction.inCachedGuild() || !interaction.guild.available) {
    await interaction.editReply(t.denied);
    return;
  }
  const guild = interaction.guild;
  await guild.roles.fetch();
  const [actor, bot] = await Promise.all([
    guild.members.fetch({ user: interaction.user.id, force: true }),
    guild.members.fetchMe({ force: true }),
  ]);
  if (!actor.permissions.has(permission) || !bot.permissions.has(permission)) {
    await interaction.editReply(t.denied);
    return;
  }

  const manager = guild.autoModerationRules;
  const rules = await manager.fetch({ cache: false });
  const command = interaction.options.getSubcommand();
  if (command === 'status') {
    const lines = ([Trigger.Spam, Trigger.MentionSpam] as const).map((trigger) => {
      const title = trigger === Trigger.Spam ? t.spam : t.mentions;
      const rule = rules.find((r) => r.triggerType === trigger);
      if (!rule) return `**${title}** · ${t.absent}`;
      const owner = owned(rule, trigger, guild.id, bot.id) ? 'Wardizitto' : t.external;
      const limit = rule.triggerMetadata.mentionTotalLimit;
      const details =
        trigger === Trigger.MentionSpam && limit !== null ? ` · ${t.limit}: ${limit}` : '';
      return `**${title}** · ${rule.enabled ? t.active : t.inactive} · ${owner}${details}`;
    });
    const panel = new ContainerBuilder()
      .setAccentColor(discordTheme.primary)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent([`## ${t.title}`, ...lines].join('\n')),
      );
    await interaction.editReply({
      flags: MessageFlags.IsComponentsV2,
      components: [panel],
      allowedMentions: { parse: [] },
    });
    return;
  }
  if (command !== 'spam' && command !== 'mencoes') throw new Error('Unknown AutoMod subcommand.');
  const trigger = command === 'spam' ? Trigger.Spam : Trigger.MentionSpam;
  const enabled = interaction.options.getBoolean('ativo', true);
  const limit = command === 'mencoes' ? interaction.options.getInteger('limite') : null;
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 50)) {
    await interaction.editReply(t.invalid);
    return;
  }
  const matches = rules.filter((r) => r.triggerType === trigger);
  const existing = matches.first();
  if (existing && (matches.size > 1 || !owned(existing, trigger, guild.id, bot.id))) {
    await interaction.editReply(t.conflict);
    return;
  }
  if (
    existing
      ? existing.enabled === enabled &&
        (limit === null || existing.triggerMetadata.mentionTotalLimit === limit)
      : !enabled
  ) {
    await interaction.editReply(t.unchanged);
    return;
  }
  const reason = `Wardizitto /automod · actor ${actor.id} · interaction ${interaction.id}`;
  let result: AutoModerationRule;
  if (existing) {
    result = await manager.edit(existing.id, {
      enabled,
      reason,
      ...(limit !== null
        ? {
            triggerMetadata: {
              mentionTotalLimit: limit,
              mentionRaidProtectionEnabled: existing.triggerMetadata.mentionRaidProtectionEnabled,
            },
          }
        : {}),
    });
  } else {
    try {
      result = await manager.create({
        name: names[trigger],
        eventType: Event.MessageSend,
        triggerType: trigger,
        enabled,
        actions: [{ type: Action.BlockMessage }],
        reason,
        ...(trigger === Trigger.MentionSpam
          ? { triggerMetadata: { mentionTotalLimit: limit ?? 5 } }
          : {}),
      });
    } catch (error) {
      // Discord enforces a single rule per trigger even when two administrators create it concurrently.
      if (
        typeof error !== 'object' ||
        error === null ||
        !('status' in error) ||
        error.status !== 400
      )
        throw error;
      const current = (await manager.fetch({ cache: false })).find(
        (r) => r.triggerType === trigger,
      );
      if (!current) throw error;
      await interaction.editReply(
        owned(current, trigger, guild.id, bot.id) ? t.changed : t.conflict,
      );
      return;
    }
  }
  client.services.logger.audit('Regra nativa de AutoMod configurada.', {
    guildId: guild.id,
    actorId: actor.id,
    interactionId: interaction.id,
    ruleId: result.id,
    trigger,
    enabled: result.enabled,
    mentionTotalLimit: result.triggerMetadata.mentionTotalLimit,
  });
  await interaction.editReply(t.saved);
}
