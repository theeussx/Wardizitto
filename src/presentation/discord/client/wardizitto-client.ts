import { Client, Collection, type ClientOptions } from 'discord.js';

import type { AppLogger } from '../../../application/ports/logger.js';
import type { MetricsService } from '../../../application/services/metrics-service.js';
import type { PermissionService } from '../../../application/services/permission-service.js';
import type { CooldownService, RateLimiter } from '../../../application/services/rate-limiter.js';
import type { AppConfig } from '../../../core/config/environment.js';
import type { Translator } from '../../../core/localization/translator.js';
import type { AfkRepository } from '../../../infrastructure/repositories/afk-repository.js';
import type { EconomyService } from '../../../modules/economy/application/economy-service.js';
import type { MarriageService } from '../../../modules/social/application/marriage-service.js';
import type { PrefixCommand, SlashCommand } from '../types/command.js';

export interface DiscordServices {
  readonly config: AppConfig;
  readonly logger: AppLogger;
  readonly translator: Translator;
  readonly permissions: PermissionService;
  readonly cooldowns: CooldownService;
  readonly rateLimiter: RateLimiter;
  readonly metrics: MetricsService;
  readonly afk: AfkRepository;
  readonly economy: EconomyService;
  readonly marriages: MarriageService;
}

export class WardizittoClient extends Client {
  public readonly commands = new Collection<string, SlashCommand>();
  public readonly prefixCommands = new Collection<string, PrefixCommand>();

  public constructor(
    options: ClientOptions,
    public readonly services: DiscordServices,
  ) {
    super(options);
  }
}
