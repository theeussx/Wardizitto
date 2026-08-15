import type { WardizittoClient } from '../client/wardizitto-client.js';

export class CommandRegistrationService {
  public constructor(private readonly client: WardizittoClient) {}

  public async register(): Promise<void> {
    const { config, logger } = this.client.services;
    if (!config.DISCORD_REGISTER_COMMANDS) {
      logger.info('Registro de slash commands desabilitado.', {}, 'discord');
      return;
    }
    if (this.client.application === null) throw new Error('Aplicação Discord indisponível.');

    const payload = this.client.commands
      .sort((left, right) => left.data.name.localeCompare(right.data.name))
      .map((command) => command.data.toJSON());

    if (config.DISCORD_GLOBAL_COMMANDS) {
      await this.client.application.commands.set(payload);
      logger.info('Slash commands globais sincronizados.', { count: payload.length }, 'discord');
      return;
    }

    const guildId = config.DISCORD_GUILD_ID;
    if (guildId === undefined) throw new Error('DISCORD_GUILD_ID não configurado.');
    const guild = await this.client.guilds.fetch(guildId);
    await guild.commands.set(payload);
    logger.info(
      'Slash commands da guild sincronizados.',
      { count: payload.length, guildId },
      'discord',
    );
  }
}
