import type { Server } from 'node:http';
import path from 'node:path';

import { GatewayIntentBits, Options, Partials } from 'discord.js';

import type { Database } from './ports/database.js';
import type { AppLogger } from './ports/logger.js';
import { MetricsService } from './services/metrics-service.js';
import { PermissionService } from './services/permission-service.js';
import { CooldownService, RateLimiter } from './services/rate-limiter.js';
import type { AppConfig } from '../core/config/environment.js';
import { Translator } from '../core/localization/translator.js';
import { configurePrivilegedUsers } from '../core/security/owner.js';
import { createDashboardServer } from '../dashboard/server.js';
import { configureLegacyDatabase } from '../infrastructure/database/legacy.js';
import { MigrationRunner } from '../infrastructure/database/migration-runner.js';
import { SafeHttpClient } from '../infrastructure/http/safe-http-client.js';
import { configureVirusTotal } from '../infrastructure/integrations/virus-total.js';
import { AfkRepository } from '../infrastructure/repositories/afk-repository.js';
import { CustomPermissionRepository } from '../infrastructure/repositories/custom-permission-repository.js';
import { GuildConfigurationService } from '../modules/configuration/application/guild-configuration.js';
import { EconomyService } from '../modules/economy/application/economy-service.js';
import { MarriageService } from '../modules/social/application/marriage-service.js';
import { WardizittoClient } from '../presentation/discord/client/wardizitto-client.js';
import { InteractionRouter } from '../presentation/discord/handlers/interaction-router.js';
import { MessageRouter } from '../presentation/discord/handlers/message-router.js';
import { registerDiscordEvents } from '../presentation/discord/register-events.js';
import { CommandRegistry } from '../presentation/discord/registries/command-registry.js';
import { ComponentRegistry } from '../presentation/discord/registries/component-registry.js';
import { CommandRegistrationService } from '../presentation/discord/services/command-registration-service.js';
import { DiscordLifecycleService } from '../presentation/discord/services/discord-lifecycle-service.js';

export class WardizittoApplication {
  private readonly client: WardizittoClient;
  private readonly lifecycle: DiscordLifecycleService;
  private readonly stopDiscordEvents: () => Promise<void>;
  private dashboard: Server | undefined;
  private stopped = false;

  public constructor(
    private readonly config: AppConfig,
    private readonly logger: AppLogger,
    private readonly database: Database,
  ) {
    configurePrivilegedUsers(config.DISCORD_OWNER_IDS, config.DISCORD_DEVELOPER_IDS);
    configureLegacyDatabase(database);

    const customPermissions = new CustomPermissionRepository(database);
    const afk = new AfkRepository(database);
    const services = {
      config,
      logger,
      translator: new Translator(config.DEFAULT_LOCALE),
      permissions: new PermissionService(customPermissions),
      cooldowns: new CooldownService(),
      rateLimiter: new RateLimiter({
        windowMs: config.RATE_LIMIT_WINDOW_MS,
        maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
      }),
      metrics: new MetricsService(logger),
      afk,
      guildConfiguration: new GuildConfigurationService(database, config.DEFAULT_LOCALE),
      economy: new EconomyService(database),
      marriages: new MarriageService(database),
    } as const;

    const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];
    if (config.DISCORD_INTENT_GUILD_MEMBERS) intents.push(GatewayIntentBits.GuildMembers);
    if (config.DISCORD_INTENT_MESSAGE_CONTENT) intents.push(GatewayIntentBits.MessageContent);

    this.client = new WardizittoClient(
      {
        intents,
        rest: { retries: 0 },
        partials: [Partials.Channel, Partials.Message],
        allowedMentions: { parse: ['users', 'roles'], repliedUser: false },
        makeCache: Options.cacheWithLimits({
          MessageManager: 100,
          ReactionManager: 0,
          GuildBanManager: 0,
          GuildInviteManager: 0,
          GuildScheduledEventManager: 20,
          PresenceManager: 0,
          VoiceStateManager: 50,
        }),
        sweepers: {
          messages: { interval: 300, lifetime: 900 },
          users: {
            interval: 3_600,
            filter: () => (user) => user.bot && user.id !== user.client.user.id,
          },
        },
      },
      services,
    );

    const registration = new CommandRegistrationService(this.client);
    this.lifecycle = new DiscordLifecycleService(this.client, registration);
    const interactions = new InteractionRouter(this.client, new ComponentRegistry());
    const messages = new MessageRouter(this.client);
    this.stopDiscordEvents = registerDiscordEvents(
      this.client,
      interactions,
      messages,
      this.lifecycle,
    );

    const http = new SafeHttpClient({
      timeoutMs: config.HTTP_TIMEOUT_MS,
      maxResponseBytes: config.HTTP_MAX_RESPONSE_BYTES,
    });
    configureVirusTotal(config.VIRUSTOTAL_API_KEY, http);
  }

  public async start(): Promise<void> {
    await this.database.connect();
    if (this.isStopped()) return;
    if (this.config.DB_MIGRATE_ON_START) {
      const applied = await new MigrationRunner(this.database, this.logger).migrate();
      this.logger.info('Migrations verificadas.', { applied }, 'database');
    }
    if (this.isStopped()) return;

    const modulesDirectory = path.resolve(__dirname, '../modules');
    await new CommandRegistry(this.client, modulesDirectory).load();
    if (this.isStopped()) return;
    await this.client.login(this.config.DISCORD_TOKEN);
    if (this.isStopped()) return;
    await this.startDashboard();
  }

  public async stop(reason: string): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    const drain = this.stopDiscordEvents();
    const closeDashboard = this.closeDashboard();
    this.logger.info('Encerramento gracioso iniciado.', { reason });
    await Promise.all([drain, closeDashboard]);
    await this.lifecycle
      .shutdown()
      .catch((error: unknown) => this.logger.error('Falha ao finalizar serviços Discord.', error));
    try {
      await this.client.destroy();
    } finally {
      await this.database.close();
    }
    this.logger.info('Aplicação encerrada.', { reason });
  }

  private isStopped(): boolean {
    return this.stopped;
  }

  private async startDashboard(): Promise<void> {
    const {
      DASHBOARD_PUBLIC_ORIGIN,
      DASHBOARD_DISCORD_CLIENT_ID,
      DASHBOARD_DISCORD_CLIENT_SECRET,
      DASHBOARD_PORT,
      DASHBOARD_HOST,
    } = this.config;
    if (
      !DASHBOARD_PUBLIC_ORIGIN ||
      !DASHBOARD_DISCORD_CLIENT_ID ||
      !DASHBOARD_DISCORD_CLIENT_SECRET
    )
      return;

    try {
      const dashboard = createDashboardServer({
        publicOrigin: DASHBOARD_PUBLIC_ORIGIN,
        clientId: DASHBOARD_DISCORD_CLIENT_ID,
        clientSecret: DASHBOARD_DISCORD_CLIENT_SECRET,
        guildConfiguration: this.client.services.guildConfiguration,
        isBotInGuild: (id) =>
          this.client.isReady() && this.client.guilds.cache.get(id)?.available === true,
        onError: (event) =>
          this.logger.warn('Falha em solicitação do dashboard.', { event }, 'api'),
      });
      this.dashboard = dashboard;
      await new Promise<void>((resolve, reject) => {
        dashboard.once('error', reject);
        dashboard.listen(DASHBOARD_PORT, DASHBOARD_HOST, () => {
          dashboard.off('error', reject);
          dashboard.on('error', (error) =>
            this.logger.error('Falha no servidor do dashboard.', error, {}, 'api'),
          );
          resolve();
        });
      });
      if (this.isStopped()) {
        await this.closeDashboard();
        return;
      }
      this.logger.info('Dashboard disponível.', { port: DASHBOARD_PORT }, 'api');
    } catch (error) {
      this.logger.error('Não foi possível iniciar o dashboard.', error, {}, 'api');
    }
  }

  private async closeDashboard(): Promise<void> {
    const dashboard = this.dashboard;
    if (dashboard?.listening !== true) return;
    await new Promise<void>((resolve) => {
      dashboard.close((error) => {
        if (error) this.logger.error('Falha ao encerrar o dashboard.', error, {}, 'api');
        resolve();
      });
    });
  }
}
