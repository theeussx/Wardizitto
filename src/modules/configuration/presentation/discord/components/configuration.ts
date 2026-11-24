import { MessageFlags } from 'discord.js';
import type { ComponentRoute } from '../../../../../presentation/discord/registries/component-registry.js';
import { isLocale } from '../../../application/guild-configuration.js';
import { configurationPanel, copy, guildActor, revisionFromPanel } from '../panel.js';

export const configurationRoute: ComponentRoute = {
  name: 'configuration',
  matches: (id) => id.startsWith('cfg:'),
  async execute(interaction, client) {
    if (!interaction.isStringSelectMenu()) return;
    const actor = guildActor(interaction);
    const revision = revisionFromPanel(
      interaction.customId,
      actor,
      Date.now() - interaction.message.createdTimestamp,
    );
    const [locale] = interaction.values;
    if (revision === null || interaction.values.length !== 1 || !isLocale(locale)) {
      await interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: copy[interaction.locale.startsWith('en') ? 'en-US' : 'pt-BR'].invalid,
      });
      return;
    }

    await interaction.deferUpdate();
    const service = client.services.guildConfiguration;
    const updated = await service.setLocale(actor, locale, revision);
    const settings = updated ?? (await service.read(actor));
    await interaction.editReply(configurationPanel(actor, settings, updated ? 'saved' : 'stale'));
  },
};
