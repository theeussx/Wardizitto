import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

import type { Database } from '../../application/ports/database.js';
import type { AppLogger } from '../../application/ports/logger.js';
import { DatabaseError } from '../../core/errors/app-error.js';

interface MigrationRow extends RowDataPacket {
  readonly name: string;
  readonly checksum: string;
}

const checksum = (content: string): string =>
  createHash('sha256').update(content, 'utf8').digest('hex');

const splitStatements = (content: string): readonly string[] =>
  content
    .split(/^-- migrate:split\s*$/mu)
    .map((statement) => statement.trim())
    .filter(Boolean);

export class MigrationRunner {
  public constructor(
    private readonly database: Database,
    private readonly logger: AppLogger,
    private readonly migrationsDirectory = path.join(__dirname, 'migrations'),
  ) {}

  public async migrate(): Promise<number> {
    await this.database.query<ResultSetHeader>(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const lockRows = await this.database.query<RowDataPacket[]>(
      "SELECT GET_LOCK('wardizitto:migrations', 30) AS acquired",
    );
    if (Number(lockRows[0]?.acquired) !== 1) {
      throw new DatabaseError('Não foi possível adquirir o lock de migrations.');
    }

    try {
      return await this.applyPendingMigrations();
    } finally {
      await this.database.query<RowDataPacket[]>("SELECT RELEASE_LOCK('wardizitto:migrations')");
    }
  }

  private async applyPendingMigrations(): Promise<number> {
    const appliedRows = await this.database.query<MigrationRow[]>(
      'SELECT name, checksum FROM schema_migrations ORDER BY name',
    );
    const applied = new Map(appliedRows.map((row) => [row.name, row.checksum]));
    const files = (await readdir(this.migrationsDirectory))
      .filter((name) => /^\d{3}_[a-z0-9_-]+\.sql$/u.test(name))
      .sort();

    let count = 0;
    for (const name of files) {
      const content = await readFile(path.join(this.migrationsDirectory, name), 'utf8');
      const hash = checksum(content);
      const previousHash = applied.get(name);
      if (previousHash !== undefined) {
        if (previousHash !== hash) {
          throw new DatabaseError(`A migration aplicada ${name} foi alterada.`, {
            code: 'MIGRATION_CHECKSUM_MISMATCH',
            details: { name },
          });
        }
        continue;
      }

      this.logger.info('Aplicando migration.', { name }, 'database');
      for (const statement of splitStatements(content)) {
        await this.database.query(statement);
      }
      await this.database.query<ResultSetHeader>(
        'INSERT INTO schema_migrations (name, checksum) VALUES (?, ?)',
        [name, hash],
      );
      count += 1;
      this.logger.info('Migration aplicada.', { name }, 'database');
    }
    return count;
  }
}
