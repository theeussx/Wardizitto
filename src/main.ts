import { WardizittoApplication } from './application/wardizitto-application.js';
import { loadEnvironment } from './core/config/environment.js';
import { MySqlDatabase } from './infrastructure/database/mysql-database.js';
import { createLogger } from './infrastructure/logging/winston-logger.js';

const bootstrap = async (): Promise<void> => {
  const config = loadEnvironment();
  const logger = createLogger({
    level: config.LOG_LEVEL,
    directory: config.LOG_DIRECTORY,
    retentionDays: config.LOG_RETENTION_DAYS,
    production: config.NODE_ENV === 'production',
  });
  const database = new MySqlDatabase(config, logger);
  const application = new WardizittoApplication(config, logger, database);

  const shutdown = (reason: string): void => {
    void application.stop(reason).finally(() => {
      process.exitCode = reason === 'SIGINT' || reason === 'SIGTERM' ? 0 : 1;
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (error) =>
    logger.error('Promise rejeitada sem tratamento.', error),
  );
  process.once('uncaughtException', (error) => {
    logger.error('Exceção não capturada; encerramento seguro solicitado.', error);
    shutdown('uncaughtException');
  });

  try {
    await application.start();
  } catch (error) {
    await application.stop('startup-failure');
    throw error;
  }
};

void bootstrap().catch((error: unknown) => {
  process.stderr.write(
    `Falha ao iniciar Wardizitto: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
