import { PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';

import { PermissionError } from '../../core/errors/app-error.js';
import { isDeveloper, isOwner } from '../../core/security/owner.js';
import type { CustomPermissionResolver } from '../ports/custom-permission-resolver.js';

export type AccessLevel =
  'EVERYONE' | 'OWNER' | 'DEVELOPER' | 'ADMINISTRATOR' | 'MODERATOR' | 'SUPPORT';

export interface AccessPolicy {
  readonly level?: AccessLevel;
  readonly guildOnly?: boolean;
  readonly guildPermissions?: readonly bigint[];
  readonly customPermission?: string;
}

const roleIdsFromInteraction = (interaction: ChatInputCommandInteraction): readonly string[] => {
  const roles = interaction.member?.roles;
  if (Array.isArray(roles)) return roles;
  if (typeof roles === 'object' && 'cache' in roles) {
    return [...roles.cache.keys()];
  }
  return [];
};

export class PermissionService {
  public constructor(private readonly customPermissions: CustomPermissionResolver) {}

  public async authorize(
    interaction: ChatInputCommandInteraction,
    policy: AccessPolicy,
  ): Promise<void> {
    if ((policy.guildOnly ?? true) && interaction.guildId === null) {
      throw new PermissionError('Este comando só pode ser usado em um servidor.');
    }

    const level = policy.level ?? 'EVERYONE';
    const userId = interaction.user.id;
    const permissions = interaction.memberPermissions;
    const owner = isOwner(userId);

    const allowedByLevel =
      level === 'EVERYONE' ||
      owner ||
      (level === 'DEVELOPER' && isDeveloper(userId)) ||
      (level === 'ADMINISTRATOR' &&
        (permissions?.has(PermissionFlagsBits.Administrator) === true ||
          permissions?.has(PermissionFlagsBits.ManageGuild) === true)) ||
      (level === 'MODERATOR' &&
        permissions?.any([
          PermissionFlagsBits.Administrator,
          PermissionFlagsBits.ModerateMembers,
          PermissionFlagsBits.ManageMessages,
          PermissionFlagsBits.KickMembers,
          PermissionFlagsBits.BanMembers,
        ]) === true) ||
      (level === 'SUPPORT' &&
        interaction.guildId !== null &&
        (await this.customPermissions.hasPermission(
          interaction.guildId,
          userId,
          roleIdsFromInteraction(interaction),
          'support',
        )));

    if (!allowedByLevel) throw new PermissionError();

    for (const permission of policy.guildPermissions ?? []) {
      if (permissions?.has(permission) !== true && !owner) throw new PermissionError();
    }

    if (policy.customPermission !== undefined && interaction.guildId !== null && !owner) {
      const allowed = await this.customPermissions.hasPermission(
        interaction.guildId,
        userId,
        roleIdsFromInteraction(interaction),
        policy.customPermission,
      );
      if (!allowed) throw new PermissionError();
    }
  }
}
