import {
  AutoModerationActionType as Action,
  AutoModerationRuleEventType as Event,
  AutoModerationRuleTriggerType as Trigger,
  Collection,
  MessageFlags,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { describe, expect, it, vi } from 'vitest';

import { data, execute } from '../../src/modules/moderation/presentation/discord/slash/automod.js';
import type { WardizittoClient } from '../../src/presentation/discord/client/wardizitto-client.js';

function rule(triggerType = Trigger.MentionSpam) {
  return {
    id: 'rule',
    guild: { id: 'guild' },
    creatorId: 'bot',
    eventType: Event.MessageSend,
    name: triggerType === Trigger.Spam ? 'Wardizitto · Spam' : 'Wardizitto · Mentions',
    triggerType,
    enabled: true,
    actions: [{ type: Action.BlockMessage }],
    triggerMetadata: {
      mentionTotalLimit: triggerType === Trigger.Spam ? null : 5,
      mentionRaidProtectionEnabled: true,
    },
  };
}

function setup(command: string, existing?: ReturnType<typeof rule>) {
  const actorCan = vi.fn(() => true);
  const botCan = vi.fn(() => true);
  const fetchRules = vi.fn(async () => new Collection(existing ? [[existing.id, existing]] : []));
  const create = vi.fn(async () => rule());
  const edit = vi.fn(async () => rule());
  const audit = vi.fn();
  const editReply = vi.fn();
  const mock = {
    id: 'interaction',
    user: { id: 'actor' },
    locale: 'en-US',
    inCachedGuild: () => true,
    guild: {
      id: 'guild',
      available: true,
      roles: { fetch: vi.fn() },
      members: {
        fetch: vi.fn(async () => ({ id: 'actor', permissions: { has: actorCan } })),
        fetchMe: vi.fn(async () => ({ id: 'bot', permissions: { has: botCan } })),
      },
      autoModerationRules: { fetch: fetchRules, create, edit },
    },
    options: {
      getSubcommand: () => command,
      getBoolean: vi.fn(() => true),
      getInteger: vi.fn((): number | null => null),
    },
    deferReply: vi.fn(),
    editReply,
  };
  // Only Discord's network-backed interaction and client are substituted, at the command boundary.
  const run = () =>
    execute(
      mock as unknown as ChatInputCommandInteraction,
      { services: { logger: { audit } } } as unknown as WardizittoClient,
    );
  return { mock, actorCan, botCan, fetchRules, create, edit, audit, editReply, run };
}

describe('native guild AutoMod', () => {
  it('registers a guild-only localized contract with Manage Guild and mention bounds', () => {
    const json = data.toJSON();
    expect(json).toMatchObject({ contexts: [0], default_member_permissions: '32' });
    expect(json.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'mencoes',
          name_localizations: { 'en-US': 'mentions' },
          options: expect.arrayContaining([
            expect.objectContaining({ name: 'limite', min_value: 1, max_value: 50 }),
          ]),
        }),
      ]),
    );
  });
  it.each(['actorCan', 'botCan'] as const)(
    'denies a caller when %s is false after the permission refresh',
    async (field) => {
      const f = setup('spam');
      f[field].mockReturnValue(false);
      await f.run();
      expect(f.mock.guild.roles.fetch).toHaveBeenCalled();
      expect(f.mock.guild.members.fetch).toHaveBeenCalledWith({ user: 'actor', force: true });
      expect(f.fetchRules).not.toHaveBeenCalled();
      expect(f.editReply).toHaveBeenCalledWith(expect.stringContaining('Manage Server'));
    },
  );
  it.each([
    { creatorId: 'other' },
    { name: 'Custom rule' },
    { guild: { id: 'other' } },
    { actions: [{ type: Action.Timeout }] },
  ])('preserves a rule outside the managed contract (%o)', async (changes) => {
    const f = setup('mencoes', { ...rule(), ...changes });
    f.mock.options.getBoolean.mockReturnValue(false);
    await f.run();
    expect(f.editReply).toHaveBeenCalledWith(expect.stringContaining('existing rule'));
    expect(f.edit).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
    expect(f.audit).not.toHaveBeenCalled();
  });
  it('reports external and absent rules privately without a mutation', async () => {
    const f = setup('status', { ...rule(), creatorId: 'other' });
    await f.run();
    expect(f.mock.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
    const payload = f.editReply.mock.calls[0]?.[0];
    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
    const serialized = JSON.stringify(payload.components);
    expect(serialized).toContain('Managed outside this command');
    expect(serialized).toContain('No rule');
    expect(serialized).toContain('Limit per message: 5');
    expect(f.create).not.toHaveBeenCalled();
    expect(f.edit).not.toHaveBeenCalled();
  });
  it.each(['spam', 'mencoes'])(
    'creates an opt-in %s rule that blocks messages and audits the decision',
    async (command) => {
      const f = setup(command);
      await f.run();
      expect(f.create).toHaveBeenCalledWith({
        name: command === 'spam' ? 'Wardizitto · Spam' : 'Wardizitto · Mentions',
        eventType: Event.MessageSend,
        triggerType: command === 'spam' ? Trigger.Spam : Trigger.MentionSpam,
        enabled: true,
        actions: [{ type: Action.BlockMessage }],
        reason: expect.stringContaining('actor'),
        ...(command === 'spam' ? {} : { triggerMetadata: { mentionTotalLimit: 5 } }),
      });
      expect(f.audit).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ guildId: 'guild', actorId: 'actor', ruleId: 'rule' }),
      );
    },
  );
  it('retains exclusions, actions and mention raid protection on a limit change', async () => {
    const f = setup('mencoes', rule());
    f.mock.options.getInteger.mockReturnValue(12);
    await f.run();
    expect(f.edit).toHaveBeenCalledWith('rule', {
      enabled: true,
      reason: expect.any(String),
      triggerMetadata: { mentionTotalLimit: 12, mentionRaidProtectionEnabled: true },
    });
  });
  it('disables the owned spam rule without deleting it or changing other settings', async () => {
    const f = setup('spam', rule(Trigger.Spam));
    f.mock.options.getBoolean.mockReturnValue(false);
    await f.run();
    expect(f.edit).toHaveBeenCalledWith('rule', { enabled: false, reason: expect.any(String) });
  });
  it.each([false, true])('skips redundant writes when a rule exists = %s', async (exists) => {
    const f = setup('mencoes', exists ? rule() : undefined);
    f.mock.options.getBoolean.mockReturnValue(exists);
    await f.run();
    expect(f.create).not.toHaveBeenCalled();
    expect(f.edit).not.toHaveBeenCalled();
    expect(f.audit).not.toHaveBeenCalled();
  });
  it('rejects invalid limits before a write', async () => {
    const f = setup('mencoes');
    f.mock.locale = 'pt-BR';
    f.mock.options.getInteger.mockReturnValue(51);
    await f.run();
    expect(f.editReply).toHaveBeenCalledWith(expect.stringContaining('1 a 50'));
    expect(f.create).not.toHaveBeenCalled();
  });
  it('rereads a concurrent native constraint conflict without overwriting or retrying', async () => {
    const f = setup('mencoes');
    const external = { ...rule(), creatorId: 'another-admin' };
    f.fetchRules
      .mockResolvedValueOnce(new Collection())
      .mockResolvedValueOnce(new Collection([[external.id, external]]));
    f.create.mockRejectedValueOnce({ status: 400 });
    await f.run();
    expect(f.create).toHaveBeenCalledTimes(1);
    expect(f.edit).not.toHaveBeenCalled();
    expect(f.editReply).toHaveBeenCalledWith(expect.stringContaining('existing rule'));
  });
  it('propagates unrelated API errors', async () => {
    const f = setup('spam');
    const failure = Object.assign(new Error('Forbidden'), { status: 403 });
    f.create.mockRejectedValueOnce(failure);
    await expect(f.run()).rejects.toBe(failure);
    expect(f.fetchRules).toHaveBeenCalledTimes(1);
    expect(f.audit).not.toHaveBeenCalled();
  });
});
