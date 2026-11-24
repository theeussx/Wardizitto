import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { z } from 'zod';
import type { GuildConfigurationService } from '../modules/configuration/application/guild-configuration.js';
import { DiscordAccessError, DiscordOAuth, snowflake } from './discord-oauth.js';
import type { DiscordGuild } from './discord-oauth.js';
import { DashboardSessions, flowLifetime, matchesToken } from './session-store.js';
import type { Session } from './session-store.js';
import { errorPage, guildListPage, guildPage, homePage, stylesheet } from './views.js';
import type { ErrorCode } from './views.js';

const callbackPath = '/oauth/discord/callback';
const bodyLimit = 4096;
const preferenceSchema = z.strictObject({
  locale: z.enum(['pt-BR', 'en-US']),
  revision: z.number().int().min(0).max(4294967295),
});
const formSchema = z.strictObject({
  locale: preferenceSchema.shape.locale,
  revision: z
    .string()
    .regex(/^\d{1,10}$/u)
    .transform(Number)
    .pipe(preferenceSchema.shape.revision),
  csrf: z.string(),
});

class RequestError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
  ) {
    super(code);
  }
}

export interface DashboardOptions {
  readonly publicOrigin: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly guildConfiguration: Pick<GuildConfigurationService, 'read' | 'setLocale'>;
  readonly isBotInGuild: (guildId: string) => boolean;
  readonly onError?: (event: string) => void;
  readonly fetch?: typeof fetch;
  readonly now?: () => number;
}

function dashboardOrigin(value: string): URL {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('Dashboard public origin must be HTTPS or HTTP loopback, without a path');
  }
  return url;
}

function findCookie(request: IncomingMessage, name: string): string | undefined {
  const values = request.headers.cookie?.split(';').flatMap((item) => {
    const trimmed = item.trim();
    return trimmed.startsWith(`${name}=`) ? [trimmed.slice(name.length + 1)] : [];
  });
  const id = values?.[0];
  return values?.length === 1 && id && /^[A-Za-z0-9_-]{43}$/u.test(id) ? id : undefined;
}

function send(response: ServerResponse, status: number, type: string, body: string): void {
  response.writeHead(status, { 'content-type': `${type}; charset=utf-8` });
  response.end(body);
}

function redirect(response: ServerResponse, location: string): void {
  response.writeHead(303, { location });
  response.end();
}

async function bodyText(request: IncomingMessage, contentType: string): Promise<string> {
  if (
    request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== contentType ||
    request.headers['content-encoding'] !== undefined
  ) {
    throw new RequestError(415, 'unsupportedBody');
  }
  if (Number(request.headers['content-length']) > bodyLimit) {
    throw new RequestError(413, 'largeBody');
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    if (!Buffer.isBuffer(chunk)) throw new RequestError(400, 'invalidRequest');
    size += chunk.length;
    if (size > bodyLimit) throw new RequestError(413, 'largeBody');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function bodyForm(request: IncomingMessage): Promise<Record<string, string>> {
  const params = new URLSearchParams(await bodyText(request, 'application/x-www-form-urlencoded'));
  const data = Object.fromEntries(params);
  if (params.size !== Object.keys(data).length) throw new RequestError(400, 'invalidRequest');
  return data;
}

async function bodyJson(request: IncomingMessage): Promise<unknown> {
  const raw = await bodyText(request, 'application/json');
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new RequestError(400, 'invalidRequest');
  }
}

class RequestLimit {
  private readonly counts = new Map<string, number>();
  private endsAt = 0;
  private total = 0;

  public constructor(private readonly now: () => number) {}

  public allow(key: string, limit: number): boolean {
    const now = this.now();
    if (this.endsAt <= now) {
      this.endsAt = now + 60_000;
      this.counts.clear();
      this.total = 0;
    }
    const count = this.counts.get(key) ?? 0;
    if (this.total >= 4000 || count >= limit) return false;
    this.counts.set(key, count + 1);
    this.total += 1;
    return true;
  }
}

export function createDashboardServer(options: DashboardOptions): Server {
  const origin = dashboardOrigin(options.publicOrigin);
  if (!snowflake.safeParse(options.clientId).success || !options.clientSecret.trim()) {
    throw new Error('Dashboard OAuth client configuration is incomplete');
  }
  const secure = origin.protocol === 'https:';
  const cookiePrefix = secure ? '__Host-' : '';
  const flowCookie = `${cookiePrefix}wardizitto-oauth`;
  const sessionCookie = `${cookiePrefix}wardizitto-session`;
  const now = options.now ?? Date.now;
  const sessions = new DashboardSessions(now);
  const limits = new RequestLimit(now);
  const oauth = new DiscordOAuth(
    options.clientId,
    options.clientSecret,
    new URL(callbackPath, origin).toString(),
    options.fetch ?? globalThis.fetch,
  );

  function cookie(name: string, id: string, maxAge: number): string {
    return `${name}=${id}; Max-Age=${maxAge}; Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  }

  function setHeaders(response: ServerResponse): void {
    response.setHeader('cache-control', 'no-store');
    response.setHeader(
      'content-security-policy',
      "default-src 'none'; style-src 'self'; form-action 'self' https://discord.com; frame-ancestors 'none'; base-uri 'none'",
    );
    response.setHeader('referrer-policy', 'same-origin');
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('x-frame-options', 'DENY');
    if (secure) response.setHeader('strict-transport-security', 'max-age=31536000');
  }

  function requireOrigin(request: IncomingMessage): void {
    if (request.headers.origin !== origin.origin) throw new RequestError(403, 'accessDenied');
  }

  function requireCsrf(actual: string | null | undefined, expected: string): void {
    if (!matchesToken(actual, expected)) throw new RequestError(403, 'accessDenied');
  }

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const target = request.url;
    if (
      !target?.startsWith('/') ||
      target.startsWith('//') ||
      target.includes('\\') ||
      target.length > 4096
    ) {
      throw new RequestError(400, 'invalidRequest');
    }
    const url = new URL(target, origin);
    if (url.origin !== origin.origin) throw new RequestError(400, 'invalidRequest');
    const { pathname, searchParams } = url;
    const method = request.method;
    const sessionId = findCookie(request, sessionCookie);
    const session = sessions.get(sessionId);
    const locale = session?.locale ?? 'pt-BR';
    const clientAddress = request.socket.remoteAddress ?? 'unknown';

    if (method === 'GET' && pathname === '/assets/dashboard.css') {
      send(response, 200, 'text/css', stylesheet);
      return;
    }
    if (method === 'GET' && pathname === '/') {
      send(response, 200, 'text/html', homePage(locale, Boolean(session)));
      return;
    }
    if (method === 'POST' && pathname === '/oauth/discord') {
      requireOrigin(request);
      if (!limits.allow(`login:${clientAddress}`, 30)) throw new RequestError(429, 'rateLimit');
      const flow = sessions.begin(findCookie(request, flowCookie));
      if (!flow) throw new RequestError(429, 'rateLimit');
      response.setHeader('set-cookie', cookie(flowCookie, flow.id, flowLifetime));
      redirect(response, oauth.authorize(flow.state, flow.verifier));
      return;
    }
    if (method === 'GET' && pathname === callbackPath) {
      response.setHeader('referrer-policy', 'no-referrer');
      if (!limits.allow(`callback:${clientAddress}`, 30)) throw new RequestError(429, 'rateLimit');
      const state = searchParams.get('state');
      if (searchParams.getAll('state').length !== 1 || !state) {
        throw new RequestError(400, 'oauthFailed');
      }
      const flow = sessions.takeFlow(findCookie(request, flowCookie), state);
      if (!flow) throw new RequestError(400, 'oauthFailed');
      const cleared = cookie(flowCookie, '', 0);
      response.setHeader('set-cookie', cleared);
      const code = searchParams.get('code');
      if (
        searchParams.has('error') ||
        searchParams.getAll('code').length !== 1 ||
        !code ||
        code.length > 1024
      ) {
        throw new RequestError(400, 'oauthFailed');
      }
      let identity;
      try {
        identity = await oauth.exchange(code, flow.verifier);
      } catch {
        options.onError?.('dashboard_oauth_exchange_failed');
        throw new RequestError(502, 'oauthFailed');
      }
      const authenticated = sessions.authenticate(identity, identity.expiresIn, sessionId);
      if (!authenticated) throw new RequestError(429, 'rateLimit');
      response.setHeader('set-cookie', [
        cleared,
        cookie(sessionCookie, authenticated.id, authenticated.maxAge),
      ]);
      redirect(response, '/dashboard');
      return;
    }

    const guildRoute = /^\/(dashboard\/guilds|api\/v1\/guilds)\/(\d{17,20})(\/settings)?$/u.exec(
      pathname,
    );
    const htmlGuildId =
      guildRoute?.[1] === 'dashboard/guilds' && !guildRoute[3] ? guildRoute[2] : undefined;
    const apiGuildId =
      guildRoute?.[1] === 'api/v1/guilds' && guildRoute[3] ? guildRoute[2] : undefined;
    const listPage = pathname === '/dashboard' && method === 'GET';
    const listApi = pathname === '/api/v1/guilds' && method === 'GET';
    const settingsPage = htmlGuildId !== undefined && (method === 'GET' || method === 'POST');
    const settingsApi = apiGuildId !== undefined && (method === 'GET' || method === 'PATCH');
    const logout = pathname === '/logout' && method === 'POST';
    if (!listPage && !listApi && !settingsPage && !settingsApi && !logout) {
      throw new RequestError(404, 'notFound');
    }
    if (!session || !sessionId) {
      if (method === 'GET' && (listPage || settingsPage)) {
        redirect(response, '/');
        return;
      }
      throw new RequestError(401, 'loginRequired');
    }
    if (!limits.allow(`session:${sessionId}`, 80)) throw new RequestError(429, 'rateLimit');

    if (method !== 'GET') requireOrigin(request);
    if (logout) {
      const { csrf } = await bodyForm(request);
      requireCsrf(csrf, session.csrf);
      sessions.delete(sessionId);
      response.setHeader('set-cookie', cookie(sessionCookie, '', 0));
      redirect(response, '/');
      return;
    }

    const guildId = htmlGuildId ?? apiGuildId;
    let preference: z.infer<typeof preferenceSchema> | undefined;
    if (method === 'PATCH') {
      const csrf = request.headers['x-csrf-token'];
      requireCsrf(typeof csrf === 'string' ? csrf : null, session.csrf);
      const parsed = preferenceSchema.safeParse(await bodyJson(request));
      if (!parsed.success) throw new RequestError(400, 'invalidRequest');
      preference = parsed.data;
    }
    if (method === 'POST') {
      const parsed = formSchema.safeParse(await bodyForm(request));
      if (!parsed.success) throw new RequestError(400, 'invalidRequest');
      requireCsrf(parsed.data.csrf, session.csrf);
      preference = parsed.data;
    }

    const guilds = await readGuilds(session, sessionId, response);
    if (sessions.get(sessionId) !== session) throw new RequestError(401, 'loginRequired');
    const installedGuilds = guilds.filter((guild) => options.isBotInGuild(guild.id));
    if (listPage) {
      send(response, 200, 'text/html', guildListPage(session, installedGuilds));
      return;
    }
    if (listApi) {
      send(
        response,
        200,
        'application/json',
        JSON.stringify({
          guilds: installedGuilds.map(({ id, name }) => ({ id, name })),
          csrfToken: session.csrf,
        }),
      );
      return;
    }
    const guild = installedGuilds.find(({ id }) => id === guildId);
    if (!guild) throw new RequestError(404, 'notFound');
    const actor = { guildId: guild.id, userId: session.userId, canManageGuild: true };
    if (preference) {
      const settings = await options.guildConfiguration.setLocale(
        actor,
        preference.locale,
        preference.revision,
      );
      if (!settings) throw new RequestError(409, 'revisionConflict');
      if (settingsPage) redirect(response, `/dashboard/guilds/${guild.id}?saved=1`);
      else send(response, 200, 'application/json', JSON.stringify(settings));
      return;
    }
    const settings = await options.guildConfiguration.read(actor);
    if (settingsPage) {
      send(
        response,
        200,
        'text/html',
        guildPage(session, guild, settings, searchParams.get('saved') === '1'),
      );
    } else {
      send(response, 200, 'application/json', JSON.stringify(settings));
    }
  }

  async function readGuilds(
    session: Session,
    sessionId: string,
    response: ServerResponse,
  ): Promise<DiscordGuild[]> {
    try {
      return await oauth.managedGuilds(session.accessToken);
    } catch (error) {
      if (error instanceof DiscordAccessError) {
        sessions.delete(sessionId);
        response.setHeader('set-cookie', cookie(sessionCookie, '', 0));
        throw new RequestError(401, 'loginRequired');
      }
      options.onError?.('dashboard_discord_guilds_failed');
      throw new RequestError(502, 'discordUnavailable');
    }
  }

  const server = createServer(
    { requestTimeout: 15_000, headersTimeout: 10_000, keepAliveTimeout: 5000, maxHeaderSize: 8192 },
    (request, response) => {
      setHeaders(response);
      void handle(request, response).catch((error: unknown) => {
        const issue = error instanceof RequestError ? error : new RequestError(500, 'serverError');
        if (issue.status === 500) options.onError?.('dashboard_request_failed');
        if (response.destroyed || response.headersSent) return;
        if (issue.status === 429) response.setHeader('retry-after', '60');
        if (!request.complete) response.setHeader('connection', 'close');
        if (request.url?.startsWith('/api/')) {
          send(response, issue.status, 'application/json', JSON.stringify({ error: issue.code }));
        } else {
          const locale = sessions.get(findCookie(request, sessionCookie))?.locale ?? 'pt-BR';
          send(response, issue.status, 'text/html', errorPage(locale, issue.code));
        }
      });
    },
  );
  server.maxConnections = 512;
  return server;
}
