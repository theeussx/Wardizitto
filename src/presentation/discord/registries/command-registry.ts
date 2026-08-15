import { readdir } from 'node:fs/promises';
import path from 'node:path';

import type { Client, Message } from 'discord.js';

import type {
  AccessLevel,
  AccessPolicy,
} from '../../../application/services/permission-service.js';
import { ConfigurationError } from '../../../core/errors/app-error.js';
import type { WardizittoClient } from '../client/wardizitto-client.js';
import type { CommandData, PrefixCommand, SlashCommand } from '../types/command.js';

interface LegacySlashCommand {
  readonly data: CommandData;
  readonly cooldown?: number;
  readonly cooldownMs?: number;
  readonly access?: AccessPolicy;
  execute(interaction: Parameters<SlashCommand['execute']>[0], client: Client): Promise<unknown>;
  autocomplete?(
    interaction: Parameters<NonNullable<SlashCommand['autocomplete']>>[0],
    client: Client,
  ): Promise<unknown>;
}

interface LegacyPrefixCommand {
  readonly name: string;
  readonly description?: string;
  run?(client: Client, message: Message<true>, arguments_: readonly string[]): Promise<unknown>;
  execute?(message: Message<true>, arguments_: readonly string[]): Promise<unknown>;
}

const accessByCategory: Readonly<Record<string, AccessLevel>> = {
  owner: 'OWNER',
  administration: 'ADMINISTRATOR',
  moderation: 'MODERATOR',
  tickets: 'EVERYONE',
};

const filesRecursively = async (directory: string): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return filesRecursively(entryPath);
      return entry.isFile() && /\.(?:js|ts)$/u.test(entry.name) && !entry.name.endsWith('.d.ts')
        ? [entryPath]
        : [];
    }),
  );
  return nested.flat().sort();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const categoryFromPath = (file: string): string => {
  const parts = file.split(path.sep);
  const modulesIndex = parts.lastIndexOf('modules');
  return modulesIndex >= 0 ? (parts[modulesIndex + 1] ?? 'uncategorized') : 'uncategorized';
};

const loadModule = (file: string): unknown => {
  const loaded: unknown = require(file);
  if (isRecord(loaded) && 'default' in loaded) return loaded.default;
  return loaded;
};

const isSlash = (value: unknown): value is LegacySlashCommand =>
  isRecord(value) &&
  isRecord(value.data) &&
  typeof value.data.name === 'string' &&
  typeof value.data.toJSON === 'function' &&
  typeof value.execute === 'function';

const isPrefix = (value: unknown): value is LegacyPrefixCommand =>
  isRecord(value) &&
  typeof value.name === 'string' &&
  (typeof value.run === 'function' || typeof value.execute === 'function');

export class CommandRegistry {
  public constructor(
    private readonly client: WardizittoClient,
    private readonly modulesDirectory: string,
  ) {}

  public async load(): Promise<void> {
    const files = await filesRecursively(this.modulesDirectory);
    for (const file of files) {
      if (!file.includes(`${path.sep}discord${path.sep}`)) continue;
      if (
        !file.includes(`${path.sep}slash${path.sep}`) &&
        !file.includes(`${path.sep}prefix${path.sep}`)
      ) {
        continue;
      }
      const loaded = loadModule(file);
      const category = categoryFromPath(file);
      if (isSlash(loaded)) {
        this.addSlash(loaded, category, file);
      } else if (isPrefix(loaded)) {
        this.addPrefix(loaded, category, file);
      } else {
        throw new ConfigurationError('Módulo de comando inválido.', { file });
      }
    }

    this.client.services.logger.info(
      'Registry de comandos carregado.',
      { slash: this.client.commands.size, prefix: this.client.prefixCommands.size },
      'discord',
    );
  }

  private addSlash(command: LegacySlashCommand, category: string, file: string): void {
    const name = command.data.name;
    if (this.client.commands.has(name)) {
      throw new ConfigurationError(`Slash command duplicado: ${name}`, { file });
    }
    const inferredAccess: AccessPolicy = {
      guildOnly: true,
      level: accessByCategory[category] ?? 'EVERYONE',
    };
    const autocomplete = command.autocomplete?.bind(command);
    const wrapped: SlashCommand = {
      data: command.data,
      category,
      access: command.access ?? inferredAccess,
      ...(command.cooldownMs === undefined && command.cooldown === undefined
        ? {}
        : { cooldownMs: command.cooldownMs ?? command.cooldown }),
      execute: (interaction, client) => command.execute(interaction, client),
      ...(autocomplete === undefined
        ? {}
        : {
            autocomplete: (interaction, client) => autocomplete(interaction, client),
          }),
    };
    this.client.commands.set(name, wrapped);
    this.client.services.logger.debug('Slash command carregado.', { name, category }, 'discord');
  }

  private addPrefix(command: LegacyPrefixCommand, category: string, file: string): void {
    const name = command.name.toLowerCase();
    if (this.client.prefixCommands.has(name)) {
      throw new ConfigurationError(`Comando de prefixo duplicado: ${name}`, { file });
    }
    const wrapped: PrefixCommand = {
      name,
      category,
      ...(command.description === undefined ? {} : { description: command.description }),
      execute: async (client, message, arguments_) => {
        if (command.run !== undefined) return command.run(client, message, arguments_);
        return command.execute?.(message, arguments_);
      },
    };
    this.client.prefixCommands.set(name, wrapped);
    this.client.services.logger.debug(
      'Comando de prefixo carregado.',
      { name, category },
      'discord',
    );
  }
}
