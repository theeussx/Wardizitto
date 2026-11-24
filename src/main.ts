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

  let stopping: Promise<void> | undefined;
  const shutdown = (reason: string, fatal: boolean): Promise<void> => {
    if (fatal) process.exitCode = 1;
    if (stopping) return stopping;
    const deadline = setTimeout(() => {
      process.stderr.write('O Wardizitto excedeu o prazo de encerramento.\n');
      process.exit(1);
    }, 10_000);
    deadline.unref();
    stopping = application.stop(reason).catch((error: unknown) => {
      process.exitCode = 1;
      logger.error('Falha durante o encerramento do Wardizitto.', error);
    });
    return stopping;
  };

  process.once('SIGINT', () => void shutdown('SIGINT', false));
  process.once('SIGTERM', () => void shutdown('SIGTERM', false));
  process.on('unhandledRejection', (error) => {
    logger.error('Promise rejeitada sem tratamento.', error);
    void shutdown('unhandledRejection', true);
  });
  process.once('uncaughtException', (error) => {
    logger.error('Exceção não capturada; encerramento seguro solicitado.', error);
    void shutdown('uncaughtException', true);
  });

  try {
    await application.start();
  } catch (error) {
    if (stopping !== undefined) {
      await stopping;
      return;
    }
    await shutdown('startup-failure', true);
    throw error;
  }
};

void bootstrap().catch((error: unknown) => {
  process.stderr.write(
    `Falha ao iniciar Wardizitto: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
