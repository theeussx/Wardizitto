import { ComponentType, ContainerBuilder, MessageFlags, PermissionFlagsBits } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';
import { GuildConfigurationService } from '../../src/modules/configuration/application/guild-configuration.js';
import {
  configurationPanel,
  revisionFromPanel,
  copy,
} from '../../src/modules/configuration/presentation/discord/panel.js';
import { data } from '../../src/modules/configuration/presentation/discord/slash/config.js';
import { configurationRoute } from '../../src/modules/configuration/presentation/discord/components/configuration.js';

const actor = { guildId: '100000000000000001', userId: '100000000000000002', canManageGuild: true };

describe('/config', () => {
  it('registra a permissão nativa e descrições nos dois idiomas', () => {
    expect(data.toJSON()).toMatchObject({
      name: 'config',
      default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
      description_localizations: {
        'en-US': 'Configure Wardizitto for this server.',
        'pt-BR': 'Configure o Wardizitto neste servidor.',
      },
    });
  });

  it.each(['pt-BR', 'en-US'] as const)('serializa a preferência salva em %s', (locale) => {
    const message = configurationPanel(actor, { locale, revision: 1 }, 'saved');
    expect(message.flags).toEqual(MessageFlags.IsComponentsV2);
    expect(message).not.toHaveProperty('content');
    expect(message).not.toHaveProperty('embeds');
    const container = message.components?.[0];
    if (!(container instanceof ContainerBuilder)) throw new Error('Container ausente');
    const payload = container.toJSON();
    expect(payload.components).toContainEqual(
      expect.objectContaining({ content: copy[locale].saved }),
    );
    const row = payload.components.find((item) => item.type === ComponentType.ActionRow);
    const select = row?.components[0];
    if (select?.type !== ComponentType.StringSelect) throw new Error('Menu ausente');
    expect(select.options.filter((option) => option.default).map((option) => option.value)).toEqual(
      [locale],
    );
    expect(configurationRoute.matches(select.custom_id)).toBe(true);
    expect(revisionFromPanel(select.custom_id, actor, 1000)).toBe(1);
    expect(select.custom_id.length).toBeLessThanOrEqual(100);
    expect(
      revisionFromPanel(select.custom_id, { ...actor, userId: actor.guildId }, 1000),
    ).toBeNull();
    expect(
      revisionFromPanel(select.custom_id, { ...actor, guildId: actor.userId }, 1000),
    ).toBeNull();
    expect(revisionFromPanel(select.custom_id, actor, 900000)).toBeNull();
    expect(revisionFromPanel(select.custom_id.replace('cfg:1:', 'cfg:2:'), actor, 0)).toBeNull();
  });

  it('nega leituras e alterações sem acesso antes de consultar o banco', async () => {
    const db = { query: vi.fn(), transaction: vi.fn() };
    const settings = new GuildConfigurationService(db, 'pt-BR');
    const denied = { ...actor, canManageGuild: false };
    await expect(settings.read(denied)).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(settings.setLocale(denied, 'en-US', 0)).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    await expect(settings.setLocale(actor, 'en-US', -1)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(db.query).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
  });
});
