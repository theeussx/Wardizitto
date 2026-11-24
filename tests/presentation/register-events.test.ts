import { Events } from 'discord.js';
import { expect, it, vi } from 'vitest';

import type { WardizittoClient } from '../../src/presentation/discord/client/wardizitto-client.js';
import { registerDiscordEvents } from '../../src/presentation/discord/register-events.js';

it('bloqueia novas interações e aguarda as já admitidas durante o encerramento', async () => {
  const handlers = new Map<string, () => void>();
  const error = vi.fn();
  const subscribe = (event: string, listener: () => void): void => {
    handlers.set(event, listener);
  };
  const client = {
    on: subscribe,
    once: subscribe,
    services: { logger: { error } },
  } as unknown as WardizittoClient;
  let rejectWork: (error: Error) => void = () => {
    throw new Error('Trabalho ainda não iniciado.');
  };
  const interactionRouter = {
    handle: vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectWork = reject;
        }),
    ),
  };
  const ignore = vi.fn(() => Promise.resolve());
  const stop = registerDiscordEvents(
    client,
    interactionRouter,
    { handle: ignore },
    { ready: ignore, guildCreated: ignore, guildDeleted: ignore, memberChanged: vi.fn() },
  );

  const emit = handlers.get(Events.InteractionCreate);
  expect(emit).toBeDefined();
  emit?.();
  const stopped = vi.fn();
  const draining = stop().then(stopped);
  emit?.();
  await Promise.resolve();
  expect(interactionRouter.handle).toHaveBeenCalledTimes(1);
  expect(stopped).not.toHaveBeenCalled();

  rejectWork(new Error('test failure'));
  await draining;
  expect(error).toHaveBeenCalledExactlyOnceWith(
    'Falha não tratada em evento Discord.',
    expect.any(Error),
    { event: Events.InteractionCreate },
    'discord',
  );
  expect(stopped).toHaveBeenCalledTimes(1);
});
