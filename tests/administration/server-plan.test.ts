import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { execute } from '../../src/modules/administration/presentation/discord/slash/criarserver.js';
import type { WardizittoClient } from '../../src/presentation/discord/client/wardizitto-client.js';

const plan = {
  roles: [{ name: 'Membro', color: '#3b82f6' }],
  categories: [{ name: 'Comunidade', channels: [{ name: 'geral', type: 'text' }] }],
};

interface Scenario {
  roles: ReturnType<typeof vi.fn>;
  channels: ReturnType<typeof vi.fn>;
  editReply: ReturnType<typeof vi.fn>;
  logger: { audit: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  run(): Promise<void>;
}

function setup(action = 'confirm', allowed = true, initialAllowed = true): Scenario {
  const roles = vi.fn().mockResolvedValue({});
  const channels = vi.fn().mockResolvedValue({ id: 'category' });
  const deferUpdate = vi.fn().mockResolvedValue(undefined);
  const invite = {
    guildId: 'guild',
    user: { id: 'actor' },
    customId: `server-plan:v1:${action}`,
    deferUpdate,
  };
  const awaitMessageComponent = vi.fn(
    ({ filter }: { filter: (button: typeof invite) => boolean }) =>
      filter(invite) ? Promise.resolve(invite) : Promise.reject(new Error('timeout')),
  );
  const editReply = vi.fn().mockResolvedValue({ awaitMessageComponent });
  const interaction = {
    user: { id: 'actor' },
    guild: {
      id: 'guild',
      available: true,
      members: {
        me: { permissions: { has: () => true } },
        fetch: () => Promise.resolve({ permissions: { has: () => allowed } }),
      },
      roles: { create: roles, fetch: () => Promise.resolve() },
      channels: { create: channels },
    },
    options: { getBoolean: () => null, getString: () => 'Comunidade de jogos' },
    member: { permissions: { has: () => initialAllowed } },
    memberPermissions: { has: () => true },
    inCachedGuild: () => true,
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply,
  };
  const logger = { audit: vi.fn(), error: vi.fn() };
  const client = {
    services: {
      config: {
        GROQ_API_KEY: 'test',
        GROQ_MODEL: 'test',
        HTTP_TIMEOUT_MS: 500,
        HTTP_MAX_RESPONSE_BYTES: 64_000,
      },
      logger,
    },
  };
  return {
    roles,
    channels,
    editReply,
    logger,
    run: () =>
      execute(
        interaction as unknown as ChatInputCommandInteraction,
        client as unknown as WardizittoClient,
      ),
  };
}

function provider(value: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(value) } }],
        }),
      ),
    ),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('/criar-servidor', () => {
  it('aplica o plano confirmado com cargos sem permissões adicionais', async () => {
    provider(plan);
    const scenario = setup();
    await scenario.run();
    expect(scenario.editReply.mock.invocationCallOrder[0]).toBeLessThan(
      scenario.roles.mock.invocationCallOrder[0] ?? 0,
    );
    expect(scenario.roles).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Membro', permissions: 0n }),
    );
    expect(scenario.channels).toHaveBeenCalledTimes(2);
  });

  it('encerra a prévia sem alterações ao cancelar', async () => {
    provider(plan);
    const scenario = setup('cancel');
    await scenario.run();
    expect(scenario.roles).not.toHaveBeenCalled();
    expect(scenario.channels).not.toHaveBeenCalled();
  });

  it('impede alterações se as permissões forem revogadas antes da confirmação', async () => {
    provider(plan);
    const scenario = setup('confirm', false);
    await scenario.run();
    expect(scenario.editReply).toHaveBeenLastCalledWith(
      expect.objectContaining({ components: [] }),
    );
    expect(scenario.roles).not.toHaveBeenCalled();
    expect(scenario.channels).not.toHaveBeenCalled();
  });

  it('recusa permissão concedida apenas no canal antes de contactar o provedor', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const scenario = setup('confirm', true, false);
    await expect(scenario.run()).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('recusa resposta acima do limite sem confiar no cabeçalho de tamanho', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(64_001));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body)));
    const scenario = setup();
    await expect(scenario.run()).rejects.toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR' });
    expect(scenario.editReply).not.toHaveBeenCalled();
  });

  it('rejeita antes da prévia um plano que especifique permissões', async () => {
    provider({ ...plan, roles: [{ name: 'Equipe', permissions: ['Administrator'] }] });
    const scenario = setup();
    await expect(scenario.run()).rejects.toMatchObject({ code: 'EXTERNAL_SERVICE_ERROR' });
    expect(scenario.editReply).not.toHaveBeenCalled();
    expect(scenario.roles).not.toHaveBeenCalled();
  });

  it('registra o resultado parcial e para de criar após uma falha', async () => {
    provider(plan);
    const scenario = setup();
    scenario.channels.mockRejectedValueOnce(new Error('Discord indisponível'));
    await scenario.run();
    expect(scenario.channels).toHaveBeenCalledOnce();
    expect(scenario.logger.audit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        roles: 1,
        categories: 0,
        channels: 0,
        completed: false,
      }),
    );
  });
});
