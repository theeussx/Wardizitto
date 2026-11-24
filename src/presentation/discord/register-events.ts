import { Events } from 'discord.js';

import type { WardizittoClient } from './client/wardizitto-client.js';
import type { InteractionRouter } from './handlers/interaction-router.js';
import type { MessageRouter } from './handlers/message-router.js';
import type { DiscordLifecycleService } from './services/discord-lifecycle-service.js';

export const registerDiscordEvents = (
  client: WardizittoClient,
  interactionRouter: Pick<InteractionRouter, 'handle'>,
  messageRouter: Pick<MessageRouter, 'handle'>,
  lifecycle: Pick<
    DiscordLifecycleService,
    'ready' | 'guildCreated' | 'guildDeleted' | 'memberChanged'
  >,
): (() => Promise<void>) => {
  let accepting = true;
  const pending = new Set<Promise<void>>();
  const safely = (event: string, work: () => Promise<void>): void => {
    if (!accepting) return;
    const task = Promise.resolve()
      .then(work)
      .catch((error: unknown) => {
        client.services.logger.error(
          'Falha não tratada em evento Discord.',
          error,
          { event },
          'discord',
        );
      });
    pending.add(task);
    const removeTask = (): void => {
      pending.delete(task);
    };
    void task.then(removeTask, removeTask);
  };

  client.once(Events.ClientReady, () => safely(Events.ClientReady, () => lifecycle.ready()));
  client.on(Events.InteractionCreate, (interaction) =>
    safely(Events.InteractionCreate, () => interactionRouter.handle(interaction)),
  );
  client.on(Events.MessageCreate, (message) =>
    safely(Events.MessageCreate, () => messageRouter.handle(message)),
  );
  client.on(Events.GuildCreate, (guild) =>
    safely(Events.GuildCreate, () => lifecycle.guildCreated(guild)),
  );
  client.on(Events.GuildDelete, (guild) =>
    safely(Events.GuildDelete, () => lifecycle.guildDeleted(guild)),
  );
  client.on(Events.GuildMemberAdd, (member) => {
    if (accepting) lifecycle.memberChanged(member);
  });
  client.on(Events.GuildMemberRemove, (member) => {
    if (accepting) lifecycle.memberChanged(member);
  });

  client.on(Events.Error, (error) =>
    client.services.logger.error('Erro do cliente Discord.', error),
  );
  client.on(Events.Warn, (message) =>
    client.services.logger.warn('Aviso do cliente Discord.', { message }, 'discord'),
  );
  client.on(Events.ShardError, (error, shardId) =>
    client.services.logger.error('Erro de shard Discord.', error, { shardId }, 'discord'),
  );
  return async () => {
    accepting = false;
    await Promise.allSettled(pending);
  };
};
