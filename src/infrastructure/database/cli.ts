import { loadEnvironment } from '../../core/config/environment.js';
import { MySqlDatabase } from './mysql-database.js';
import { MigrationRunner } from './migration-runner.js';
import { createLogger } from '../logging/winston-logger.js';

const main = async (): Promise<void> => {
  const config = loadEnvironment();
  const logger = createLogger({
    level: config.LOG_LEVEL,
    directory: config.LOG_DIRECTORY,
    retentionDays: config.LOG_RETENTION_DAYS,
    production: config.NODE_ENV === 'production',
  });
  const database = new MySqlDatabase(config, logger);
  try {
    await database.connect();
    const command = process.argv[2];
    if (command !== 'migrate') throw new Error(`Comando de banco desconhecido: ${String(command)}`);
    const count = await new MigrationRunner(database, logger).migrate();
    logger.info('Migrations concluídas.', { applied: count }, 'database');
  } finally {
    await database.close();
  }
};

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
