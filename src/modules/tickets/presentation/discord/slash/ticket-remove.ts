import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { editParticipant } from '../participants.js';

export const data = new SlashCommandBuilder()
  .setName('ticket-remove')
  .setDescription('Remove um membro do ticket atual.')
  .addUserOption((option) =>
    option.setName('usuario').setDescription('O usuário a ser removido.').setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await editParticipant(interaction, false);
}
