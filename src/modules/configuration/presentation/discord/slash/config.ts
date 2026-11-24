import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { WardizittoClient } from '../../../../../presentation/discord/client/wardizitto-client.js';
import { configurationPanel, guildActor } from '../panel.js';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configure o Wardizitto neste servidor.')
  .setDescriptionLocalizations({
    'en-US': 'Configure Wardizitto for this server.',
    'pt-BR': 'Configure o Wardizitto neste servidor.',
  })
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);
export const access = { guildOnly: true } as const;

export async function execute(
  interaction: ChatInputCommandInteraction,
  client: WardizittoClient,
): Promise<void> {
  const actor = guildActor(interaction);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const settings = await client.services.guildConfiguration.read(actor);
  await interaction.editReply(configurationPanel(actor, settings));
}
