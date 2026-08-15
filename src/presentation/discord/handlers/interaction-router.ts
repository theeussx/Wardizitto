import { MessageFlags, type Interaction } from 'discord.js';

import { PermissionError } from '../../../core/errors/app-error.js';
import { isOwner } from '../../../core/security/owner.js';
import type { WardizittoClient } from '../client/wardizitto-client.js';
import { InteractionErrorHandler } from '../errors/interaction-error-handler.js';
import type { ComponentRegistry } from '../registries/component-registry.js';

export class InteractionRouter {
  private readonly errors: InteractionErrorHandler;

  public constructor(
    private readonly client: WardizittoClient,
    private readonly components: ComponentRegistry,
  ) {
    this.errors = new InteractionErrorHandler(client.services.logger, client.services.translator);
  }

  public async handle(interaction: Interaction): Promise<void> {
    const startedAt = performance.now();
    const operation = this.operationName(interaction);
    const logger = this.client.services.logger.child({
      correlationId: interaction.id,
      operation,
      guildId: interaction.guildId,
      userId: interaction.user.id,
    });

    try {
      if (interaction.isAutocomplete()) {
        this.consumeRateLimit(interaction);
        const command = this.client.commands.get(interaction.commandName);
        if (command?.autocomplete === undefined) {
          await interaction.respond([]);
          return;
        }
        await command.autocomplete(interaction, this.client);
        return;
      }

      if (interaction.isChatInputCommand()) {
        this.consumeRateLimit(interaction);
        const command = this.client.commands.get(interaction.commandName);
        if (command === undefined) {
          await interaction.reply({
            content: this.client.services.translator.translate('error.commandMissing'),
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        await this.client.services.permissions.authorize(interaction, command.access);
        const cooldownMs = command.cooldownMs ?? this.client.services.config.COMMAND_COOLDOWN_MS;
        if (!isOwner(interaction.user.id) && cooldownMs > 0) {
          this.client.services.cooldowns.assertAvailable(
            `${interaction.guildId ?? 'dm'}:${interaction.user.id}:${interaction.commandName}`,
            cooldownMs,
          );
        }
        await command.execute(interaction, this.client);
        logger.audit('Slash command executado.', {
          command: interaction.commandName,
          category: command.category,
        });
        return;
      }

      if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
        const route = this.components.resolve(interaction.customId);
        if (route === undefined) return;
        this.consumeRateLimit(interaction);
        if (route.ownerOnly === true && !isOwner(interaction.user.id)) throw new PermissionError();
        await route.execute(interaction, this.client);
        logger.audit('Componente executado.', { route: route.name });
      }
    } catch (error) {
      await this.errors.handle(interaction, error);
    } finally {
      this.client.services.metrics.record(operation, performance.now() - startedAt);
    }
  }

  private consumeRateLimit(interaction: Interaction): void {
    this.client.services.rateLimiter.consume(
      `${interaction.guildId ?? 'dm'}:${interaction.user.id}`,
    );
  }

  private operationName(interaction: Interaction): string {
    if (interaction.isChatInputCommand()) return `command:${interaction.commandName}`;
    if (interaction.isAutocomplete()) return `autocomplete:${interaction.commandName}`;
    if (interaction.isMessageComponent() || interaction.isModalSubmit()) {
      return `component:${interaction.customId.split(/[_:-]/u, 1)[0] ?? 'unknown'}`;
    }
    return `interaction:${String(interaction.type)}`;
  }
}
