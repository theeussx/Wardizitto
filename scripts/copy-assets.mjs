import { cp, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src');
const output = path.join(root, 'dist');

const copyAssets = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const input = path.join(directory, entry.name);
      if (entry.isDirectory()) return copyAssets(input);
      if (!entry.isFile() || !/\.(?:json|sql)$/u.test(entry.name)) return undefined;
      const destination = path.join(output, path.relative(source, input));
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(input, destination);
      return undefined;
    }),
  );
};

await copyAssets(source);
