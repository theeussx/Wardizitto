import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd());
const modulesRoot = path.join(root, 'src', 'modules');
const presentationRoot = path.join(root, 'src', 'presentation');

const collectFiles = async (
  directory: string,
  extensions: readonly string[] = ['.js', '.ts'],
): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectFiles(entryPath, extensions);
      return entry.isFile() && extensions.includes(path.extname(entry.name)) ? [entryPath] : [];
    }),
  );
  return nested.flat().sort();
};

const FORBIDDEN_LEGACY_BUILDERS = ['EmbedBuilder', 'ModalBuilder', 'TextInputBuilder'] as const;
const HARDCODED_EMOJI_MENTION = /<a?:\w+:\d{15,20}>/u;
const HARDCODED_SNOWFLAKE = /\b\d{17,20}\b/u;

describe('Consistência de UI dos comandos', () => {
  it('nenhum módulo usa EmbedBuilder, ModalBuilder ou TextInputBuilder', async () => {
    const files = await collectFiles(modulesRoot);
    const offenders: string[] = [];
    for (const file of files) {
      const content = await readFile(file, 'utf8');
      for (const token of FORBIDDEN_LEGACY_BUILDERS) {
        if (content.includes(token)) offenders.push(`${path.relative(root, file)} (${token})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('a camada de apresentação não usa EmbedBuilder', async () => {
    const files = await collectFiles(presentationRoot);
    const offenders: string[] = [];
    for (const file of files) {
      const content = await readFile(file, 'utf8');
      if (content.includes('EmbedBuilder')) offenders.push(path.relative(root, file));
    }
    expect(offenders).toEqual([]);
  });

  it('não há IDs Discord hardcoded nos módulos', async () => {
    const files = await collectFiles(modulesRoot);
    const offenders: string[] = [];
    for (const file of files) {
      const content = await readFile(file, 'utf8');
      if (HARDCODED_EMOJI_MENTION.test(content) || HARDCODED_SNOWFLAKE.test(content)) {
        offenders.push(path.relative(root, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('mantém os contratos de 55 slash commands e 13 prefix commands', async () => {
    const files = await collectFiles(modulesRoot);
    const slash = files.filter((file) => file.includes(`${path.sep}slash${path.sep}`)).length;
    const prefix = files.filter((file) => file.includes(`${path.sep}prefix${path.sep}`)).length;
    expect(slash).toBe(55);
    expect(prefix).toBe(13);
  });
});
