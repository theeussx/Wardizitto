import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  type MessageCreateOptions,
} from 'discord.js';
import { discordTheme } from '../../../../core/design/discord-theme.js';

interface TicketAppearance {
  readonly embed_title: string | null;
  readonly embed_description: string | null;
  readonly embed_color: string | null;
}

export function ticketOpeningPanel(
  appearance: TicketAppearance,
  locale: string,
): MessageCreateOptions {
  const english = locale.startsWith('en');
  const title = (appearance.embed_title ?? '') || (english ? 'Support' : 'Central de suporte');
  const detail =
    (appearance.embed_description ?? '') ||
    (english
      ? 'Open a private channel to contact the support team.'
      : 'Abra um canal privado para conversar com a equipe de suporte.');
  const color =
    appearance.embed_color && /^#[\da-f]{6}$/iu.test(appearance.embed_color)
      ? Number.parseInt(appearance.embed_color.slice(1), 16)
      : discordTheme.primary;
  const panel = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents((text) => text.setContent(`## ${title}\n${detail}`))
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('open_ticket')
          .setStyle(ButtonStyle.Primary)
          .setLabel(english ? 'Open ticket' : 'Abrir ticket'),
      ),
    );
  return {
    components: [panel],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] },
  };
}
