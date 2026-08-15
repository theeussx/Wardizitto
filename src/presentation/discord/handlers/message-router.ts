import { EmbedBuilder, type Message } from 'discord.js';

import type { WardizittoClient } from '../client/wardizitto-client.js';
import { PrefixCommandHandler } from './prefix-command-handler.js';

export class MessageRouter {
  private readonly prefix: PrefixCommandHandler;

  public constructor(private readonly client: WardizittoClient) {
    this.prefix = new PrefixCommandHandler(client);
  }

  public async handle(message: Message): Promise<void> {
    if (message.author.bot || !message.inGuild()) return;

    try {
      await this.processAfk(message);
      const handled = await this.prefix.handle(message);
      if (!handled) await this.respondToMention(message);
    } catch (error) {
      this.client.services.logger.error('Erro no processamento de mensagem.', error, {
        messageId: message.id,
        guildId: message.guildId,
        userId: message.author.id,
      });
    }
  }

  private async processAfk(message: Message<true>): Promise<void> {
    const mentionedIds = [...message.mentions.users.keys()].filter(
      (id) => id !== message.author.id,
    );
    const statuses = await this.client.services.afk.findMany(message.guildId, [
      message.author.id,
      ...mentionedIds,
    ]);
    const ownStatus = statuses.find((status) => status.userId === message.author.id);
    if (
      ownStatus !== undefined &&
      (await this.client.services.afk.remove(message.guildId, message.author.id))
    ) {
      await message.channel
        .send(`👋 <@${message.author.id}>, seu status AFK foi removido.`)
        .catch(() => undefined);
    }

    const mentionedStatuses = statuses.filter((status) => status.userId !== message.author.id);
    if (mentionedStatuses.length === 0) return;
    const description = mentionedStatuses
      .slice(0, 10)
      .map((status) => `<@${status.userId}> está AFK: ${status.message.slice(0, 300)}`)
      .join('\n');
    await message
      .reply({
        embeds: [
          new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('Usuário AFK')
            .setDescription(description),
        ],
        allowedMentions: { repliedUser: false },
      })
      .catch(() => undefined);
  }

  private async respondToMention(message: Message<true>): Promise<void> {
    const userId = this.client.user?.id;
    if (userId === undefined) return;
    const content = message.content.trim();
    if (content !== `<@${userId}>` && content !== `<@!${userId}>`) return;

    this.client.services.rateLimiter.consume(`${message.guildId}:${message.author.id}:mention`);
    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('#5865f2')
          .setTitle(`Olá, ${message.author.username}!`)
          .setDescription(
            `Meu prefixo é \`${this.client.services.config.DISCORD_PREFIX}\`. Use os comandos de barra para conhecer meus recursos.`,
          )
          .setTimestamp(),
      ],
      allowedMentions: { repliedUser: false },
    });
  }
}
