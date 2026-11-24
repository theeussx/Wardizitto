import { PermissionFlagsBits as P } from 'discord.js';

// Only permissions for ordinary text and voice participation may be self-assigned.
// An unknown future permission therefore requires a deliberate review.
const participantPermissions = [
  P.ViewChannel,
  P.SendMessages,
  P.SendMessagesInThreads,
  P.ReadMessageHistory,
  P.AddReactions,
  P.EmbedLinks,
  P.AttachFiles,
  P.UseApplicationCommands,
  P.UseExternalEmojis,
  P.UseExternalStickers,
  P.Connect,
  P.Speak,
  P.UseVAD,
  P.Stream,
  P.ChangeNickname,
  P.SendVoiceMessages,
  P.SendPolls,
].reduce((bits, flag) => bits | flag, 0n);

export const permitsSelfAssignment = (bits: bigint): boolean =>
  (bits & ~participantPermissions) === 0n;
