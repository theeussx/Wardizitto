import { createHash } from 'node:crypto';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDashboardServer } from '../../src/dashboard/server.js';
import type { Locale } from '../../src/core/localization/translator.js';
import type {
  GuildActor,
  GuildConfiguration,
} from '../../src/modules/configuration/application/guild-configuration.js';

const userId = '100000000000000001';
const clientId = '100000000000000002';
const guildId = '100000000000000003';
const nonManagedId = '100000000000000004';
const noBotId = '100000000000000005';
const ownerGuildId = '100000000000000006';
const syntheticAccessToken = 'fixture-access-value';
const settingsPath = `/api/v1/guilds/${guildId}/settings`;
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
          server.closeAllConnections();
        }),
    ),
  );
});

interface ProviderGuild {
  id: string;
  name: string;
  owner: boolean;
  permissions: string;
}

interface FixtureOptions {
  tokenExpiresIn?: number;
  publicOrigin?: string;
}

interface Fixture {
  readonly request: (path: string, options?: RequestInit) => Promise<Response>;
  readonly origin: string;
  readonly discord: ReturnType<typeof vi.fn<typeof fetch>>;
  readonly read: ReturnType<typeof vi.fn<(actor: GuildActor) => Promise<GuildConfiguration>>>;
  readonly write: ReturnType<
    typeof vi.fn<
      (actor: GuildActor, locale: Locale, revision: number) => Promise<GuildConfiguration | null>
    >
  >;
  readonly errors: ReturnType<typeof vi.fn<(event: string) => void>>;
  readonly botGuilds: Set<string>;
  readonly guilds: ProviderGuild[];
  advance: (milliseconds: number) => void;
  setProviderStatus: (status: number) => void;
}

async function launch(options: FixtureOptions = {}): Promise<Fixture> {
  const origin = options.publicOrigin ?? 'http://127.0.0.1:9009';
  let now = Date.UTC(2026, 0, 1);
  let guildStatus = 200;
  let configuration: GuildConfiguration = { locale: 'pt-BR', revision: 0 };
  const botGuilds = new Set([guildId, nonManagedId, ownerGuildId]);
  const guilds = [
    { id: guildId, name: 'Clube <azul>', owner: false, permissions: '32' },
    { id: nonManagedId, name: 'Outro', owner: false, permissions: '1024' },
    { id: noBotId, name: 'Sem bot', owner: false, permissions: '8' },
    { id: ownerGuildId, name: 'Dono', owner: true, permissions: '0' },
  ];
  const read = vi.fn(async (_actor: GuildActor): Promise<GuildConfiguration> => configuration);
  const write = vi.fn(
    async (
      _actor: GuildActor,
      locale: Locale,
      revision: number,
    ): Promise<GuildConfiguration | null> => {
      if (revision !== configuration.revision) return null;
      configuration = { locale, revision: revision + 1 };
      return configuration;
    },
  );
  const errors = vi.fn<(event: string) => void>();
  const discord = vi.fn<typeof fetch>(async (request) => {
    switch (String(request)) {
      case 'https://discord.com/api/oauth2/token':
        return Response.json({
          access_token: syntheticAccessToken,
          token_type: 'Bearer',
          expires_in: options.tokenExpiresIn ?? 604800,
          scope: 'guilds identify',
        });
      case 'https://discord.com/api/v10/users/@me':
        return Response.json({ id: userId, locale: 'en-US' });
      case 'https://discord.com/api/v10/users/@me/guilds?limit=200':
        return Response.json(guildStatus === 200 ? guilds : {}, { status: guildStatus });
      default:
        throw new Error('Unexpected provider request');
    }
  });
  const server = createDashboardServer({
    clientId,
    clientSecret: 'fixture-client-value',
    publicOrigin: origin,
    now: () => now,
    fetch: discord,
    isBotInGuild: (id) => botGuilds.has(id),
    guildConfiguration: { read, setLocale: write },
    onError: errors,
  });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('HTTP listener unavailable');
  return {
    request: (path, init) =>
      fetch(`http://127.0.0.1:${address.port}${path}`, { redirect: 'manual', ...init }),
    origin,
    discord,
    read,
    write,
    errors,
    botGuilds,
    guilds,
    advance: (milliseconds) => {
      now += milliseconds;
    },
    setProviderStatus: (status) => {
      guildStatus = status;
    },
  };
}

function cookiePair(value: string | null | undefined): string {
  const pair = value?.split(';')[0];
  if (!pair) throw new Error('Expected a response cookie');
  return pair;
}

async function startOAuth(app: Fixture): Promise<{ redirect: URL; flowCookie: string }> {
  const login = await app.request('/oauth/discord', {
    method: 'POST',
    headers: { origin: app.origin },
  });
  expect(login.status).toBe(303);
  return {
    redirect: new URL(login.headers.get('location') ?? ''),
    flowCookie: cookiePair(login.headers.get('set-cookie')),
  };
}

async function authenticate(app: Fixture): Promise<string> {
  const { redirect, flowCookie } = await startOAuth(app);
  const callback = await app.request(
    `/oauth/discord/callback?code=fixture-code&state=${redirect.searchParams.get('state') ?? ''}`,
    { headers: { cookie: flowCookie } },
  );
  expect(callback.status).toBe(303);
  return cookiePair(callback.headers.getSetCookie()[1]);
}

async function csrfToken(app: Fixture, cookie: string): Promise<string> {
  const result = await app.request('/api/v1/guilds', { headers: { cookie } });
  expect(result.status).toBe(200);
  const data: unknown = await result.json();
  if (
    typeof data !== 'object' ||
    !data ||
    !('csrfToken' in data) ||
    typeof data.csrfToken !== 'string'
  ) {
    throw new Error('Expected CSRF token');
  }
  return data.csrfToken;
}

function change(
  app: Fixture,
  cookie: string,
  csrf: string,
  revision: number,
  origin = app.origin,
): Promise<Response> {
  return app.request(settingsPath, {
    method: 'PATCH',
    headers: { origin, cookie, 'x-csrf-token': csrf, 'content-type': 'application/json' },
    body: JSON.stringify({ locale: 'en-US', revision }),
  });
}

describe('dashboard OAuth and sessions', () => {
  it('requires the canonical origin on login and binds PKCE and state to a single-use flow', async () => {
    const app = await launch();
    expect((await app.request('/oauth/discord', { method: 'POST' })).status).toBe(403);
    const { redirect, flowCookie } = await startOAuth(app);
    expect(redirect.origin).toBe('https://discord.com');
    expect(redirect.searchParams.get('scope')).toBe('identify guilds');
    expect(redirect.searchParams.get('response_type')).toBe('code');
    expect(redirect.searchParams.get('redirect_uri')).toBe(`${app.origin}/oauth/discord/callback`);
    expect(redirect.searchParams.get('code_challenge_method')).toBe('S256');
    const state = redirect.searchParams.get('state') ?? '';
    const path = `/oauth/discord/callback?code=fixture-code&state=${state}`;
    expect((await app.request(path)).status).toBe(400);
    expect(
      (await app.request(`${path}&state=${state}`, { headers: { cookie: flowCookie } })).status,
    ).toBe(400);
    expect(app.discord).not.toHaveBeenCalled();

    const valid = await app.request(path, { headers: { cookie: flowCookie } });
    expect(valid.status).toBe(303);
    expect(valid.headers.get('referrer-policy')).toBe('no-referrer');
    expect(cookiePair(valid.headers.getSetCookie()[1])).not.toBe(flowCookie);
    expect(valid.headers.getSetCookie()[1]).toContain('HttpOnly; SameSite=Lax');
    expect(valid.headers.getSetCookie()[1]).not.toContain(syntheticAccessToken);
    const tokenCall = app.discord.mock.calls[0]?.[1];
    if (!(tokenCall?.body instanceof URLSearchParams)) throw new Error('Expected provider form');
    expect(tokenCall.body.get('grant_type')).toBe('authorization_code');
    expect(tokenCall.body.get('redirect_uri')).toBe(`${app.origin}/oauth/discord/callback`);
    const verifier = tokenCall.body.get('code_verifier') ?? '';
    expect(createHash('sha256').update(verifier).digest('base64url')).toBe(
      redirect.searchParams.get('code_challenge'),
    );
    expect(tokenCall.redirect).toBe('error');
    expect((await app.request(path, { headers: { cookie: flowCookie } })).status).toBe(400);
    expect(app.discord).toHaveBeenCalledTimes(2);
  });

  it('expires pending OAuth flows and binds session lifetime to the access token', async () => {
    const app = await launch({ tokenExpiresIn: 20 });
    const { redirect, flowCookie } = await startOAuth(app);
    app.advance(5 * 60 * 1000);
    const expired = await app.request(
      `/oauth/discord/callback?state=${redirect.searchParams.get('state') ?? ''}&code=fixture-code`,
      { headers: { cookie: flowCookie } },
    );
    expect(expired.status).toBe(400);
    expect(app.discord).not.toHaveBeenCalled();
    const cookie = await authenticate(app);
    expect((await app.request(settingsPath, { headers: { cookie } })).status).toBe(200);
    app.advance(20_000);
    expect((await app.request(settingsPath, { headers: { cookie } })).status).toBe(401);
  });

  it('uses host-only secure cookies and invalidates the session on logout', async () => {
    const app = await launch({ publicOrigin: 'https://panel.example' });
    const cookie = await authenticate(app);
    expect(cookie).toMatch(/^__Host-wardizitto-session=/u);
    const csrf = await csrfToken(app, cookie);
    const body = new URLSearchParams({ csrf });
    const headers = { cookie, origin: app.origin };
    const logout = await app.request('/logout', { method: 'POST', headers, body });
    expect(logout.status).toBe(303);
    expect(logout.headers.get('strict-transport-security')).toBe('max-age=31536000');
    expect(logout.headers.get('set-cookie')).toContain(
      'Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure',
    );
    expect(logout.headers.get('set-cookie')).not.toContain('Domain=');
    expect((await app.request(settingsPath, { headers: { cookie } })).status).toBe(401);
  });
});

describe('dashboard permission and locale changes', () => {
  it('exposes only managed guilds with the bot, revalidating permissions at each access', async () => {
    const app = await launch();
    const cookie = await authenticate(app);
    const headers = { cookie };
    const listing = await app.request('/api/v1/guilds', { headers });
    const payload: unknown = await listing.json();
    expect(payload).toMatchObject({
      guilds: [
        { id: guildId, name: 'Clube <azul>' },
        { id: ownerGuildId, name: 'Dono' },
      ],
    });
    for (const id of [nonManagedId, noBotId]) {
      expect((await app.request(`/api/v1/guilds/${id}/settings`, { headers })).status).toBe(404);
    }
    const valid = await app.request(settingsPath, { headers });
    expect(valid.status).toBe(200);
    expect(app.read).toHaveBeenCalledExactlyOnceWith({ guildId, userId, canManageGuild: true });
    const guild = app.guilds.find(({ id }) => id === guildId);
    if (!guild) throw new Error('Missing provider fixture');
    guild.permissions = '1024';
    expect((await app.request(settingsPath, { headers })).status).toBe(404);
    guild.permissions = '32';
    app.botGuilds.delete(guildId);
    expect((await app.request(settingsPath, { headers })).status).toBe(404);
    expect(app.read).toHaveBeenCalledTimes(1);
  });

  it('enforces CSRF, validates payloads and rejects outdated revisions', async () => {
    const app = await launch();
    const cookie = await authenticate(app);
    const csrf = await csrfToken(app, cookie);
    expect((await change(app, cookie, csrf, 0, 'https://other.example')).status).toBe(403);
    expect((await change(app, cookie, 'invalid-token', 0)).status).toBe(403);
    expect((await change(app, cookie, csrf, -1)).status).toBe(400);
    expect(app.write).not.toHaveBeenCalled();
    const first = await change(app, cookie, csrf, 0);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ locale: 'en-US', revision: 1 });
    expect(app.write).toHaveBeenCalledExactlyOnceWith(
      { guildId, userId, canManageGuild: true },
      'en-US',
      0,
    );
    expect((await change(app, cookie, csrf, 0)).status).toBe(409);
  });

  it('renders escaped guild data and submits the bilingual HTML form to the same service', async () => {
    const app = await launch();
    const cookie = await authenticate(app);
    const path = `/dashboard/guilds/${guildId}`;
    const page = await app.request(path, { headers: { cookie } });
    const source = await page.text();
    expect(page.status).toBe(200);
    expect(page.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(source).toContain('<html lang="en-US">');
    expect(source).toContain('Clube &lt;azul&gt;');
    expect(source).not.toContain('Clube <azul>');
    const csrf = source.match(/name="csrf" value="([^"]+)"/u)?.[1] ?? '';
    const response = await app.request(path, {
      method: 'POST',
      headers: { origin: app.origin, cookie },
      body: new URLSearchParams({ csrf, locale: 'en-US', revision: '0' }),
    });
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${path}?saved=1`);
    const saved = await app.request(`${path}?saved=1`, { headers: { cookie } });
    expect(await saved.text()).toContain('Language saved.');
  });

  it('rejects oversized or unexpected request bodies before reading guild settings', async () => {
    const app = await launch();
    const cookie = await authenticate(app);
    const csrf = await csrfToken(app, cookie);
    const headers = { origin: app.origin, cookie, 'x-csrf-token': csrf };
    const large = await app.request(settingsPath, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: ' '.repeat(5000),
    });
    expect(large.status).toBe(413);
    const unsupported = await app.request(settingsPath, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'text/plain' },
      body: '{}',
    });
    expect(unsupported.status).toBe(415);
    expect(app.write).not.toHaveBeenCalled();
  });

  it('fails closed when Discord is unavailable or revokes the token', async () => {
    const app = await launch();
    const cookie = await authenticate(app);
    const headers = { cookie };
    app.setProviderStatus(503);
    const unavailable = await app.request(settingsPath, { headers });
    expect(unavailable.status).toBe(502);
    expect(await unavailable.json()).toEqual({ error: 'discordUnavailable' });
    expect(app.errors).toHaveBeenCalledExactlyOnceWith('dashboard_discord_guilds_failed');
    expect(app.read).not.toHaveBeenCalled();
    app.setProviderStatus(401);
    expect((await app.request(settingsPath, { headers })).status).toBe(401);
    const requests = app.discord.mock.calls.length;
    expect((await app.request(settingsPath, { headers })).status).toBe(401);
    expect(app.discord).toHaveBeenCalledTimes(requests);
  });
});
