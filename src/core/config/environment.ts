import path from 'node:path';

import { config as loadDotEnv } from 'dotenv';
import { z } from 'zod';

import { ConfigurationError } from '../errors/app-error.js';

const discordId = z.string().regex(/^\d{17,20}$/, 'deve ser um ID válido do Discord');

const booleanValue = (fallback: boolean): z.ZodType<boolean> =>
  z.preprocess((value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string' || value.trim() === '') return fallback;
    if (['true', '1', 'yes', 'on'].includes(value.toLowerCase())) return true;
    if (['false', '0', 'no', 'off'].includes(value.toLowerCase())) return false;
    return value;
  }, z.boolean());

const emptyAsUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const optionalDiscordId = z.preprocess(emptyAsUndefined, discordId.optional());
const optionalUrl = z.preprocess(emptyAsUndefined, z.url().optional());
const optionalNonEmptyString = z.preprocess(emptyAsUndefined, z.string().min(1).optional());

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DISCORD_TOKEN: z.string().min(20, 'é obrigatório'),
    DISCORD_OWNER_IDS: z.string().min(1, 'informe ao menos um ID'),
    DISCORD_DEVELOPER_IDS: z.string().default(''),
    DISCORD_GUILD_ID: optionalDiscordId,
    DISCORD_REGISTER_COMMANDS: booleanValue(true),
    DISCORD_GLOBAL_COMMANDS: booleanValue(false),
    DISCORD_ENABLE_PREFIX_COMMANDS: booleanValue(true),
    DISCORD_PREFIX: z.string().min(1).max(5).default('!'),
    DISCORD_INTENT_GUILD_MEMBERS: booleanValue(true),
    DISCORD_INTENT_MESSAGE_CONTENT: booleanValue(true),
    DB_HOST: z.string().min(1, 'é obrigatório'),
    DB_PORT: z.coerce.number().int().min(1).max(65_535).default(3306),
    DB_USER: z.string().min(1, 'é obrigatório'),
    DB_PASSWORD: z.string().min(1, 'é obrigatório'),
    DB_NAME: z.string().regex(/^[A-Za-z0-9_]+$/, 'contém caracteres inválidos'),
    DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
    DB_SSL: booleanValue(false),
    DB_MIGRATE_ON_START: booleanValue(true),
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'verbose', 'debug', 'silly']).default('info'),
    LOG_DIRECTORY: z.string().min(1).default('logs'),
    LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    DEFAULT_LOCALE: z.enum(['pt-BR', 'en-US']).default('pt-BR'),
    COMMAND_COOLDOWN_MS: z.coerce.number().int().min(0).max(3_600_000).default(3_000),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1_000).max(3_600_000).default(10_000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).max(1_000).default(12),
    HTTP_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(10_000),
    HTTP_MAX_RESPONSE_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(50 * 1_024 * 1_024)
      .default(10 * 1_024 * 1_024),
    GROQ_API_KEY: z.string().optional(),
    GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
    VIRUSTOTAL_API_KEY: z.string().optional(),
    WEBHOOK_LOGS_URL: optionalUrl,
    FAN_ART_REVIEW_CHANNEL_ID: optionalDiscordId,
    FAN_ART_PUBLIC_CHANNEL_ID: optionalDiscordId,
    BUG_REPORT_CHANNEL_ID: optionalDiscordId,
    STATUS_CHANNEL_ID: optionalDiscordId,
    MEMBER_COUNT_CHANNEL_ID: optionalDiscordId,
    SERVER_COUNT_GUILD_ID: optionalDiscordId,
    SERVER_COUNT_CHANNEL_ID: optionalDiscordId,
    DONATION_LOG_CHANNEL_ID: optionalDiscordId,
    VERIFICATION_ROLE_ID: optionalDiscordId,
    PIX_KEY: optionalNonEmptyString,
    PIX_COPY_PASTE: optionalNonEmptyString,
  })
  .superRefine((value, context) => {
    if (!value.DISCORD_GLOBAL_COMMANDS && !value.DISCORD_GUILD_ID && value.NODE_ENV !== 'test') {
      context.addIssue({
        code: 'custom',
        path: ['DISCORD_GUILD_ID'],
        message: 'é obrigatório quando DISCORD_GLOBAL_COMMANDS=false',
      });
    }
  });

const parseIds = (value: string): readonly string[] => {
  const ids = [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  const invalid = ids.filter((id) => !/^\d{17,20}$/.test(id));
  if (invalid.length > 0) {
    throw new ConfigurationError('IDs do Discord inválidos na configuração.', { invalid });
  }
  return Object.freeze(ids);
};

export type RawEnvironment = z.infer<typeof environmentSchema>;
export type AppConfig = Readonly<
  Omit<RawEnvironment, 'DISCORD_OWNER_IDS' | 'DISCORD_DEVELOPER_IDS'> & {
    DISCORD_OWNER_IDS: readonly string[];
    DISCORD_DEVELOPER_IDS: readonly string[];
  }
>;

export const parseEnvironment = (
  environment: Readonly<Record<string, string | undefined>>,
): AppConfig => {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      field: issue.path.join('.') || 'environment',
      message: issue.message,
    }));
    throw new ConfigurationError('A configuração da aplicação é inválida.', { issues });
  }

  return Object.freeze({
    ...result.data,
    DISCORD_OWNER_IDS: parseIds(result.data.DISCORD_OWNER_IDS),
    DISCORD_DEVELOPER_IDS: parseIds(result.data.DISCORD_DEVELOPER_IDS),
  });
};

export const loadEnvironment = (): AppConfig => {
  const mode = process.env.NODE_ENV ?? 'development';
  const candidates = [
    path.resolve(`.env.${mode}.local`),
    path.resolve('.env.local'),
    path.resolve(`.env.${mode}`),
    ...(mode === 'development' ? [path.resolve('.env.dev')] : []),
    path.resolve('.env'),
  ];

  loadDotEnv({ path: candidates, quiet: true });
  return parseEnvironment(process.env);
};
