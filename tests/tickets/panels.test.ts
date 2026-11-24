import { MessageFlags } from 'discord.js';
import { describe, expect, it } from 'vitest';

import { ticketOpeningPanel } from '../../src/modules/tickets/presentation/discord/ticket-opening-panel.js';
import { resolveVerificationRole } from '../../src/modules/verification/verification-settings.js';
import { data } from '../../src/modules/verification/presentation/discord/slash/verificacao.js';

describe('persistent verification panels', () => {
  const panel = { role_id: 'guild-role', message_id: 'current' };
  it('uses the persisted role and rejects superseded panels even with a historical role configured', () => {
    expect(resolveVerificationRole(panel, 'current', 'verify:v1', 'legacy')).toBe('guild-role');
    expect(resolveVerificationRole(panel, 'retired', 'verify_button', 'legacy')).toBeNull();
  });
  it('fails closed before a new panel is published and preserves explicit legacy configuration', () => {
    expect(resolveVerificationRole(undefined, 'pending', 'verify:v1', 'legacy')).toBeNull();
    expect(resolveVerificationRole(undefined, 'old', 'verificar_button', 'legacy')).toBe('legacy');
    expect(resolveVerificationRole(undefined, 'old', 'verify_button', undefined)).toBeUndefined();
  });
  it('serializes both slash command languages', () => {
    const command = data.toJSON();
    expect(command.name_localizations?.['en-US']).toBe('verification');
    expect(command.options?.[0]?.name_localizations?.['en-US']).toBe('role');
  });
});

describe('ticket opening panel', () => {
  it.each([
    ['en-US', 'Open ticket'],
    ['pt-BR', 'Abrir ticket'],
  ])('serializes %s without expanding user mentions', (locale, label) => {
    const panel = ticketOpeningPanel(
      { embed_title: 'Atendimento', embed_description: '@everyone', embed_color: '#4868ff' },
      locale,
    );
    expect(JSON.stringify(panel.components)).toContain(label);
    expect(JSON.stringify(panel.components)).toContain('open_ticket');
    expect(panel).toMatchObject({
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] },
    });
    expect(panel).not.toHaveProperty('content');
    expect(panel).not.toHaveProperty('embeds');
  });
});
