import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modules = path.join(root, 'dist', 'modules');
const names = new Set();
let slash = 0;
let prefix = 0;

const visit = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(file);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const kind = file.includes(`${path.sep}slash${path.sep}`)
      ? 'slash'
      : file.includes(`${path.sep}prefix${path.sep}`)
        ? 'prefix'
        : undefined;
    if (!kind) continue;
    const command = require(file);
    const name = kind === 'slash' ? command.data?.name : command.name;
    const executable = kind === 'slash' ? command.execute : (command.run ?? command.execute);
    if (typeof name !== 'string' || typeof executable !== 'function') {
      throw new Error(`Contrato de comando inválido: ${file}`);
    }
    const key = `${kind}:${name}`;
    if (names.has(key)) throw new Error(`Comando duplicado: ${key}`);
    names.add(key);
    if (kind === 'slash') {
      command.data.toJSON();
      slash += 1;
    } else {
      prefix += 1;
    }
  }
};

await visit(modules);
console.log(`Command contracts valid: ${slash} slash, ${prefix} prefix.`);
