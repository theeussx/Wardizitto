import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  Message,
  SharedSlashCommand,
  SlashCommandOptionsOnlyBuilder,
} from 'discord.js';

import type { AccessPolicy } from '../../../application/services/permission-service.js';

export type CommandData = SharedSlashCommand | SlashCommandOptionsOnlyBuilder;

export interface SlashCommand {
  readonly data: CommandData;
  readonly category: string;
  readonly access: AccessPolicy;
  readonly cooldownMs?: number;
  execute(interaction: ChatInputCommandInteraction, client: Client): Promise<unknown>;
  autocomplete?(interaction: AutocompleteInteraction, client: Client): Promise<unknown>;
}

export interface PrefixCommand {
  readonly name: string;
  readonly description?: string;
  readonly category: string;
  execute(client: Client, message: Message<true>, arguments_: readonly string[]): Promise<unknown>;
}
