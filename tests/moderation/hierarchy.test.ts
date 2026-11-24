import { createRequire } from 'node:module';

import { PermissionFlagsBits } from 'discord.js';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(__filename);
interface Prefix {
  run(client: unknown, message: unknown, args: string[]): Promise<unknown>;
}
interface Handler {
  execute(interaction: unknown): Promise<unknown>;
}
type Cargo = Handler & {
  access: { guildPermissions: bigint[] };
  data: { toJSON(): { default_member_permissions: string } };
};
const ban = require('../../src/modules/moderation/presentation/discord/prefix/ban.js') as Prefix;
const kick = require('../../src/modules/moderation/presentation/discord/prefix/kick.js') as Prefix;
const cargo = require('../../src/modules/moderation/presentation/discord/slash/cargo.js') as Cargo;

describe('hierarquia de moderação', () => {
  it.each([ban, kick])('impede moderar membro com cargo igual ou superior', async (command) => {
    const action = vi.fn();
    const reply = vi.fn();
    const target = {
      id: 'target',
      roles: { highest: { comparePositionTo: () => 0 } },
      bannable: true,
      kickable: true,
      ban: action,
      kick: action,
    };
    const message = {
      member: { permissions: { has: () => true }, roles: { highest: {} } },
      author: { id: 'moderator' },
      guild: { ownerId: 'owner' },
      mentions: { members: { first: () => target } },
      reply,
    };
    await command.run({}, message, []);
    expect(action).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledOnce();
  });

  it('impede atribuir cargo acima do executor mesmo quando o bot pode atribuí-lo', async () => {
    const add = vi.fn();
    const reply = vi.fn();
    const role = { comparePositionTo: () => 1 };
    const target = { id: 'target', roles: { add, highest: { comparePositionTo: () => -1 } } };
    const interaction = {
      options: { getUser: () => ({ id: 'target' }), getRole: () => role },
      member: { permissions: { has: () => true }, roles: { highest: {} } },
      guild: { ownerId: 'owner', members: { cache: new Map([['target', target]]) } },
      user: { id: 'moderator' },
      reply,
    };
    await cargo.execute(interaction);
    expect(add).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledOnce();
  });
});

describe('permissões de ações de moderação', () => {
  it('exige Gerenciar Cargos na política do comando', () => {
    expect(cargo.access.guildPermissions).toEqual([PermissionFlagsBits.ManageRoles]);
    expect(cargo.data.toJSON().default_member_permissions).toBe(
      String(PermissionFlagsBits.ManageRoles),
    );
  });

  it('impede advertências ao proprietário mesmo com cargo inferior', async () => {
    const handler =
      require('../../src/modules/moderation/presentation/discord/components/member-management.js') as Handler;
    const showModal = vi.fn();
    const reply = vi.fn();
    const target = {
      id: '123456789012345678',
      user: { bot: false },
      roles: { highest: { position: 1 } },
    };
    await handler.execute({
      inGuild: () => true,
      isButton: () => true,
      customId: 'adminAction_warn_123456789012345678',
      memberPermissions: { any: () => true },
      guild: { ownerId: target.id, members: { fetch: () => Promise.resolve(target) } },
      member: { roles: { highest: { position: 2 } } },
      user: { id: 'moderator' },
      showModal,
      reply,
    });
    expect(showModal).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledOnce();
  });

  it('impede timeout quando o executor possui apenas Gerenciar Mensagens', async () => {
    const handler =
      require('../../src/modules/moderation/presentation/discord/components/member-management.js') as Handler;
    const timeout = vi.fn();
    const reply = vi.fn();
    const target = {
      id: '123456789012345678',
      user: { bot: false },
      roles: { highest: { position: 1 } },
      moderatable: true,
      timeout,
    };
    const interaction = {
      inGuild: () => true,
      isButton: () => false,
      isModalSubmit: () => true,
      customId: 'adminAction_modal_timeout_123456789012345678',
      memberPermissions: {
        any: () => true,
        has: (permission: bigint) => permission === PermissionFlagsBits.ManageMessages,
      },
      guild: { ownerId: 'owner', members: { fetch: () => Promise.resolve(target) } },
      member: { roles: { highest: { position: 2 } } },
      user: { id: 'moderator' },
      fields: { getTextInputValue: () => '1h' },
      reply,
    };
    await handler.execute(interaction);
    expect(timeout).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledOnce();
  });
});
