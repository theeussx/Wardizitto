import { ActivityType, EmbedBuilder, WebhookClient, type Guild } from 'discord.js';

import type { WardizittoClient } from '../client/wardizitto-client.js';
import type { CommandRegistrationService } from './command-registration-service.js';

export class DiscordLifecycleService {
  private metricsTimer: NodeJS.Timeout | undefined;
  private readonly countTimers = new Map<string, NodeJS.Timeout>();
  private readonly webhook: WebhookClient | undefined;

  public constructor(
    private readonly client: WardizittoClient,
    private readonly commandRegistration: CommandRegistrationService,
  ) {
    const url = client.services.config.WEBHOOK_LOGS_URL;
    this.webhook = url === undefined ? undefined : new WebhookClient({ url });
  }

  public async ready(): Promise<void> {
    const user = this.client.user;
    if (user === null) throw new Error('Usuário do bot indisponível após ready.');
    user.setPresence({
      activities: [
        {
          name: `${String(this.client.guilds.cache.size)} servidores`,
          type: ActivityType.Watching,
        },
      ],
      status: 'online',
    });
    await this.commandRegistration.register();
    await this.sendStatus('🟢 Bot online.');

    this.metricsTimer = setInterval(() => {
      this.client.services.logger.info('Snapshot de métricas.', {
        metrics: this.client.services.metrics.snapshot(),
        guilds: this.client.guilds.cache.size,
        websocketPing: this.client.ws.ping,
        memory: process.memoryUsage(),
      });
    }, 300_000);
    this.metricsTimer.unref();

    this.client.services.logger.info(
      'Cliente Discord pronto.',
      { user: user.tag, guilds: this.client.guilds.cache.size },
      'discord',
    );
  }

  public async guildCreated(guild: Guild): Promise<void> {
    this.client.services.logger.audit('Bot adicionado a uma guild.', {
      guildId: guild.id,
      guildName: guild.name,
      memberCount: guild.memberCount,
    });
    await this.webhook
      ?.send({ content: `✅ Bot adicionado a **${guild.name}** (\`${guild.id}\`).` })
      .catch((error: unknown) =>
        this.client.services.logger.error('Falha no webhook de guildCreate.', error),
      );

    const embed = new EmbedBuilder()
      .setColor('#5865f2')
      .setTitle('Obrigado por adicionar o Wardizitto!')
      .setDescription(
        'Use os comandos de barra para começar. Administradores podem configurar tickets com `/setup-tickets`.',
      )
      .setTimestamp();
    const owner = await guild.fetchOwner().catch(() => undefined);
    await owner?.send({ embeds: [embed] }).catch(() => undefined);
    this.scheduleServerCountUpdate();
  }

  public async guildDeleted(guild: Guild): Promise<void> {
    this.client.services.logger.audit('Bot removido de uma guild.', {
      guildId: guild.id,
      guildName: guild.name,
    });
    await this.webhook
      ?.send({ content: `❌ Bot removido de **${guild.name}** (\`${guild.id}\`).` })
      .catch((error: unknown) =>
        this.client.services.logger.error('Falha no webhook de guildDelete.', error),
      );
    this.scheduleServerCountUpdate();
  }

  public memberChanged(member: { readonly guild: Guild }): void {
    const channelId = this.client.services.config.MEMBER_COUNT_CHANNEL_ID;
    if (channelId === undefined) return;
    this.debounce(`members:${member.guild.id}`, async () => {
      const channel = await member.guild.channels.fetch(channelId).catch(() => undefined);
      if (channel?.isVoiceBased() === true) {
        await channel.setName(`「👥」 Membros: ${String(member.guild.memberCount)}`);
      }
    });
  }

  public async shutdown(): Promise<void> {
    if (this.metricsTimer !== undefined) clearInterval(this.metricsTimer);
    for (const timer of this.countTimers.values()) clearTimeout(timer);
    this.countTimers.clear();
    await this.sendStatus('🔴 Bot offline.').catch(() => undefined);
    this.webhook?.destroy();
  }

  private scheduleServerCountUpdate(): void {
    const guildId = this.client.services.config.SERVER_COUNT_GUILD_ID;
    const channelId = this.client.services.config.SERVER_COUNT_CHANNEL_ID;
    if (guildId === undefined || channelId === undefined) return;
    this.debounce('server-count', async () => {
      const guild = await this.client.guilds.fetch(guildId).catch(() => undefined);
      const channel = await guild?.channels.fetch(channelId).catch(() => undefined);
      if (channel?.isVoiceBased() === true) {
        await channel.setName(`「🌍」 Servidores: ${String(this.client.guilds.cache.size)}`);
      }
    });
  }

  private debounce(key: string, work: () => Promise<void>): void {
    const previous = this.countTimers.get(key);
    if (previous !== undefined) clearTimeout(previous);
    const timer = setTimeout(() => {
      this.countTimers.delete(key);
      void work().catch((error: unknown) =>
        this.client.services.logger.error('Falha ao atualizar contador Discord.', error, { key }),
      );
    }, 2_000);
    timer.unref();
    this.countTimers.set(key, timer);
  }

  private async sendStatus(content: string): Promise<void> {
    const channelId = this.client.services.config.STATUS_CHANNEL_ID;
    if (channelId === undefined) return;
    const channel = await this.client.channels.fetch(channelId).catch(() => undefined);
    if (channel?.isSendable() === true) await channel.send({ content });
  }
}
