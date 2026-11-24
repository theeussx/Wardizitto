import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { editParticipant } from '../participants.js';

export const data = new SlashCommandBuilder()
  .setName('ticket-add')
  .setDescription('Adiciona um membro ao ticket atual.')
  .addUserOption((option) =>
    option.setName('usuario').setDescription('O usuário a ser adicionado.').setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await editParticipant(interaction, true);
}
