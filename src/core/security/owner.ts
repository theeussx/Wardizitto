import { ConfigurationError } from '../errors/app-error.js';

let owners: ReadonlySet<string> = new Set();
let developers: ReadonlySet<string> = new Set();

export const configurePrivilegedUsers = (
  ownerIds: readonly string[],
  developerIds: readonly string[],
): void => {
  if (ownerIds.length === 0) {
    throw new ConfigurationError('Ao menos um owner deve ser configurado.');
  }
  owners = new Set(ownerIds);
  developers = new Set(developerIds);
};

export const isOwner = (userId: string): boolean => owners.has(userId);
export const isDeveloper = (userId: string): boolean =>
  owners.has(userId) || developers.has(userId);
