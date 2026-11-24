import {
  ActionRowBuilder,
  ContainerBuilder,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  type InteractionEditReplyOptions,
} from 'discord.js';
import { discordTheme } from '../../../../core/design/discord-theme.js';
import { PermissionError } from '../../../../core/errors/app-error.js';
import type { GuildActor, GuildConfiguration } from '../../application/guild-configuration.js';

export const copy = {
  'pt-BR': {
    title: 'Central de configuração',
    locale: 'Idioma do painel',
    select: 'Selecionar idioma',
    saved: 'Preferência salva.',
    stale:
      'Outro administrador atualizou a configuração. Confira o idioma atual antes de salvar novamente.',
    invalid: 'Este painel expirou ou pertence a outra sessão. Abra /config novamente.',
    denied: 'Você precisa da permissão Gerenciar servidor para configurar o Wardizitto.',
  },
  'en-US': {
    title: 'Server settings',
    locale: 'Panel language',
    select: 'Select a language',
    saved: 'Preference saved.',
    stale:
      'Another administrator updated these settings. Check the current language before saving again.',
    invalid: 'This panel expired or belongs to another session. Open /config again.',
    denied: 'You need Manage Server permission to configure Wardizitto.',
  },
} as const;

export function guildActor(
  interaction: ChatInputCommandInteraction | StringSelectMenuInteraction,
): GuildActor {
  if (
    !interaction.inCachedGuild() ||
    !interaction.guild.available ||
    !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)
  ) {
    throw new PermissionError(copy[interaction.locale.startsWith('en') ? 'en-US' : 'pt-BR'].denied);
  }
  return { guildId: interaction.guildId, userId: interaction.user.id, canManageGuild: true };
}

export function revisionFromPanel(
  id: string,
  actor: GuildActor,
  messageAgeMs: number,
): number | null {
  const match = /^cfg:1:lang:(\d{17,20}):(\d{17,20}):(0|[1-9]\d{0,9})$/u.exec(id);
  if (
    match?.[1] !== actor.guildId ||
    match[2] !== actor.userId ||
    messageAgeMs < 0 ||
    messageAgeMs >= 15 * 60_000
  )
    return null;
  const revision = Number(match[3]);
  return revision <= 4294967295 ? revision : null;
}

export function configurationPanel(
  actor: GuildActor,
  settings: GuildConfiguration,
  status?: 'saved' | 'stale',
): InteractionEditReplyOptions {
  const words = copy[settings.locale];
  const languageNames = { 'pt-BR': 'Português (Brasil)', 'en-US': 'English (US)' };
  const select = new StringSelectMenuBuilder()
    .setCustomId(`cfg:1:lang:${actor.guildId}:${actor.userId}:${String(settings.revision)}`)
    .setPlaceholder(words.select)
    .addOptions(
      Object.entries(languageNames).map(([value, label]) => ({
        value,
        label,
        default: value === settings.locale,
      })),
    );
  const container = new ContainerBuilder()
    .setAccentColor(discordTheme.primary)
    .addTextDisplayComponents((text) => text.setContent(`## Wardizitto · ${words.title}`))
    .addSeparatorComponents((divider) => divider)
    .addTextDisplayComponents((text) =>
      text.setContent(`**${words.locale}**\n${languageNames[settings.locale]}`),
    )
    .addActionRowComponents(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
  if (status) container.addTextDisplayComponents((text) => text.setContent(words[status]));
  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container],
    allowedMentions: { parse: [] },
  };
}
