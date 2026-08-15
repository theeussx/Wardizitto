import { MessageFlags, type Interaction } from 'discord.js';

import type { AppLogger } from '../../../application/ports/logger.js';
import { AppError, RateLimitError } from '../../../core/errors/app-error.js';
import type { Translator } from '../../../core/localization/translator.js';

export class InteractionErrorHandler {
  public constructor(
    private readonly logger: AppLogger,
    private readonly translator: Translator,
  ) {}

  public async handle(interaction: Interaction, error: unknown): Promise<void> {
    const appError = error instanceof AppError ? error : undefined;
    this.logger.error('Erro ao processar interação do Discord.', error, {
      interactionId: interaction.id,
      interactionType: interaction.type,
      userId: interaction.user.id,
      guildId: interaction.guildId,
      errorCode: appError?.code ?? 'UNEXPECTED_ERROR',
    });

    if (interaction.isAutocomplete()) {
      if (!interaction.responded) await interaction.respond([]).catch(() => undefined);
      return;
    }
    if (!interaction.isRepliable()) return;

    const content =
      error instanceof RateLimitError
        ? this.translator.translate('error.rateLimit', undefined, {
            seconds: Math.max(1, Math.ceil(error.retryAfterMs / 1_000)),
          })
        : appError?.expose === true
          ? `❌ ${appError.message}`
          : this.translator.translate('error.internal');
    const response = { content, flags: MessageFlags.Ephemeral } as const;

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response).catch(() => undefined);
    } else {
      await interaction.reply(response).catch(() => undefined);
    }
  }
}
