import type { Interaction } from 'discord.js';

import { ConfigurationError } from '../../../core/errors/app-error.js';
import type { WardizittoClient } from '../client/wardizitto-client.js';

const announcement =
  require('../../../modules/moderation/presentation/discord/components/announcement.js') as LegacyHandler;
const memberManagement =
  require('../../../modules/moderation/presentation/discord/components/member-management.js') as LegacyHandler;
const ownerChannelMessage =
  require('../../../modules/owner/presentation/discord/components/channel-message.js') as LegacyHandler;
const leaveGuild =
  require('../../../modules/owner/presentation/discord/components/leave-guild.js') as LegacyHandler;
const ticket =
  require('../../../modules/tickets/presentation/discord/components/ticket.js') as LegacyHandler;
const economy =
  require('../../../modules/economy/presentation/discord/components/economy.js') as LegacyHandler;
const profession =
  require('../../../modules/economy/presentation/discord/components/profession.js') as LegacyHandler;
const fanArt =
  require('../../../modules/social/presentation/discord/components/fan-art-review.js') as LegacyHandler;
const bugReport =
  require('../../../modules/utilities/presentation/discord/components/bug-report.js') as LegacyHandler;
const githubRepository =
  require('../../../modules/utilities/presentation/discord/components/github-repository.js') as LegacyHandler;
const verification =
  require('../../../modules/verification/presentation/discord/components/verification.js') as LegacyHandler;

interface LegacyHandler {
  execute(interaction: Interaction, client?: WardizittoClient): Promise<unknown>;
}

export interface ComponentRoute {
  readonly name: string;
  readonly ownerOnly?: boolean;
  matches(customId: string): boolean;
  execute(interaction: Interaction, client: WardizittoClient): Promise<unknown>;
}

const exact =
  (identifiers: readonly string[]) =>
  (customId: string): boolean =>
    identifiers.includes(customId);
const prefix =
  (identifiers: readonly string[]) =>
  (customId: string): boolean =>
    identifiers.some((identifier) => customId.startsWith(identifier));

const legacyRoute = (
  name: string,
  handler: LegacyHandler,
  matches: (customId: string) => boolean,
  ownerOnly = false,
): ComponentRoute => ({
  name,
  ...(ownerOnly ? { ownerOnly: true } : {}),
  matches,
  execute: (interaction, client) => handler.execute(interaction, client),
});

export class ComponentRegistry {
  private readonly routes: readonly ComponentRoute[] = [
    legacyRoute(
      'tickets',
      ticket,
      exact([
        'select_ticket_category',
        'select_ticket_logs',
        'select_ticket_panel',
        'select_ticket_role',
        'open_ticket',
        'close_ticket',
        'claim_ticket',
        'config_ticket_appearance',
        'send_ticket_panel',
        'modal_ticket_appearance',
      ]),
    ),
    legacyRoute(
      'economy',
      economy,
      (id) =>
        ['atm_manage', 'modal_atm', 'buy_item_select'].includes(id) ||
        /^(inventory|badges)_/u.test(id),
    ),
    legacyRoute('profession', profession, exact(['selecionar_profissao'])),
    legacyRoute('verification', verification, exact(['verify_button', 'verificar_button'])),
    legacyRoute('github-repository', githubRepository, prefix(['github_select_'])),
    legacyRoute(
      'announcement',
      announcement,
      exact([
        'cancelar_comunicado',
        'editar_comunicado',
        'modal_editar_comunicado',
        'enviar_comunicado',
        'canal_destino_comunicado',
      ]),
    ),
    legacyRoute('member-management', memberManagement, prefix(['adminAction_'])),
    legacyRoute(
      'owner-channel-message',
      ownerChannelMessage,
      (id) =>
        ['selecionar_servidor', 'selecionar_canal_destino'].includes(id) ||
        id.startsWith('enviar_mensagem_modal-'),
      true,
    ),
    legacyRoute(
      'leave-guild',
      leaveGuild,
      exact(['proxima_pagina', 'anterior_pagina', 'sair_servidor_select']),
      true,
    ),
    legacyRoute('fan-art-review', fanArt, prefix(['aprovar_fanart_', 'rejeitar_fanart_']), true),
    legacyRoute('bug-report', bugReport, prefix(['confirmar_bug_', 'resolver_bug_']), true),
  ];

  public resolve(customId: string): ComponentRoute | undefined {
    const matches = this.routes.filter((route) => route.matches(customId));
    if (matches.length > 1) {
      throw new ConfigurationError('Mais de uma rota corresponde ao componente.', {
        customId,
        routes: matches.map((route) => route.name),
      });
    }
    return matches[0];
  }
}
