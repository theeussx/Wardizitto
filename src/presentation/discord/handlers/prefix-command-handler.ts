import type { Message } from 'discord.js';

import { isOwner } from '../../../core/security/owner.js';
import type { WardizittoClient } from '../client/wardizitto-client.js';

export const parseArguments = (input: string): readonly string[] => {
  const arguments_: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (const character of input.trim()) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (quote !== undefined) {
      if (character === quote) quote = undefined;
      else current += character;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (/\s/u.test(character)) {
      if (current !== '') {
        arguments_.push(current);
        current = '';
      }
    } else {
      current += character;
    }
  }
  if (escaped) current += '\\';
  if (current !== '') arguments_.push(current);
  return arguments_;
};

export class PrefixCommandHandler {
  public constructor(private readonly client: WardizittoClient) {}

  public async handle(message: Message<true>): Promise<boolean> {
    const { config, logger, rateLimiter, cooldowns } = this.client.services;
    if (
      !config.DISCORD_ENABLE_PREFIX_COMMANDS ||
      !message.content.startsWith(config.DISCORD_PREFIX)
    ) {
      return false;
    }

    const parts = parseArguments(message.content.slice(config.DISCORD_PREFIX.length));
    const commandName = parts[0]?.toLowerCase();
    if (commandName === undefined) return false;
    const command = this.client.prefixCommands.get(commandName);
    if (command === undefined) return false;

    try {
      rateLimiter.consume(`${message.guildId}:${message.author.id}`);
      if (!isOwner(message.author.id)) {
        cooldowns.assertAvailable(
          `${message.guildId}:${message.author.id}:prefix:${commandName}`,
          config.COMMAND_COOLDOWN_MS,
        );
      }
      await command.execute(this.client, message, parts.slice(1));
      logger.audit('Comando de prefixo executado.', {
        command: commandName,
        category: command.category,
        guildId: message.guildId,
        userId: message.author.id,
      });
    } catch (error) {
      logger.error('Erro em comando de prefixo.', error, {
        command: commandName,
        guildId: message.guildId,
        userId: message.author.id,
      });
      await message.reply('⚠️ Não foi possível executar este comando.').catch(() => undefined);
    }
    return true;
  }
}
