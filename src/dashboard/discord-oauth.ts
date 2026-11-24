import { createHash } from 'node:crypto';
import { PermissionFlagsBits } from 'discord.js';
import { z } from 'zod';
import type { Locale } from '../core/localization/translator.js';
import { readLimitedBody } from '../infrastructure/http/safe-http-client.js';

const api = 'https://discord.com/api/v10';
export const snowflake = z.string().regex(/^\d{17,20}$/u);
const scope = 'identify guilds';
const identitySchema = z.object({ id: snowflake, locale: z.string().max(20).optional() });
const tokenSchema = z.object({
  access_token: z.string().regex(/^[A-Za-z0-9._~-]{1,2048}$/u),
  token_type: z.literal('Bearer'),
  expires_in: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  scope: z.string().max(1000),
});
const guildSchema = z.object({
  id: snowflake,
  name: z.string().min(1).max(200),
  owner: z.boolean(),
  permissions: z.string().regex(/^\d{1,64}$/u),
});
const guildsSchema = z.array(guildSchema).max(200);
const administrativePermissions =
  PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild;

export type DiscordGuild = z.infer<typeof guildSchema>;

interface DiscordIdentity {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly userId: string;
  readonly locale: Locale;
}

export class DiscordAccessError extends Error {
  public constructor() {
    super('Discord access token is invalid');
  }
}

export class DiscordOAuth {
  public constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
    private readonly request: typeof fetch,
  ) {}

  public authorize(state: string, verifier: string): string {
    const url = new URL('https://discord.com/oauth2/authorize');
    url.search = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope,
      state,
      code_challenge: createHash('sha256').update(verifier).digest('base64url'),
      code_challenge_method: 'S256',
    }).toString();
    return url.toString();
  }

  public async exchange(code: string, verifier: string): Promise<DiscordIdentity> {
    const token = await this.json(
      'https://discord.com/api/oauth2/token',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
          code_verifier: verifier,
        }),
      },
      tokenSchema,
    );
    const grantedScopes = new Set(token.scope.split(/\s+/u));
    if (
      grantedScopes.size !== 2 ||
      !grantedScopes.has('identify') ||
      !grantedScopes.has('guilds')
    ) {
      throw new DiscordAccessError();
    }
    const identity = await this.json(
      `${api}/users/@me`,
      { headers: this.authorization(token.access_token) },
      identitySchema,
    );
    return {
      accessToken: token.access_token,
      expiresIn: token.expires_in,
      userId: identity.id,
      locale: identity.locale === 'en-US' || identity.locale === 'en-GB' ? 'en-US' : 'pt-BR',
    };
  }

  public async managedGuilds(accessToken: string): Promise<DiscordGuild[]> {
    const guilds = await this.json(
      `${api}/users/@me/guilds?limit=200`,
      { headers: this.authorization(accessToken) },
      guildsSchema,
    );
    return guilds.filter(
      (guild) => guild.owner || (BigInt(guild.permissions) & administrativePermissions) !== 0n,
    );
  }

  private authorization(accessToken: string): HeadersInit {
    return { authorization: `Bearer ${accessToken}` };
  }

  private async json<T>(url: string, options: RequestInit, schema: z.ZodType<T>): Promise<T> {
    const response = await this.request(url, {
      ...options,
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new DiscordAccessError();
      throw new Error('Discord request failed');
    }
    const bytes = await readLimitedBody(response, 512 * 1024);
    const payload: unknown = JSON.parse(Buffer.from(bytes).toString('utf8'));
    return schema.parse(payload);
  }
}
