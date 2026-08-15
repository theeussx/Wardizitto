export interface AppErrorOptions extends ErrorOptions {
  readonly code?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly expose?: boolean;
  readonly retryable?: boolean;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly details: Readonly<Record<string, unknown>>;
  public readonly expose: boolean;
  public readonly retryable: boolean;

  public constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options);
    this.name = new.target.name;
    this.code = options.code ?? 'INTERNAL_ERROR';
    this.details = Object.freeze({ ...options.details });
    this.expose = options.expose ?? false;
    this.retryable = options.retryable ?? false;
    Error.captureStackTrace(this, new.target);
  }
}

export class ConfigurationError extends AppError {
  public constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(message, {
      code: 'CONFIGURATION_ERROR',
      ...(details === undefined ? {} : { details }),
      expose: true,
    });
  }
}

export class ValidationError extends AppError {
  public constructor(message: string, details?: Readonly<Record<string, unknown>>) {
    super(message, {
      code: 'VALIDATION_ERROR',
      ...(details === undefined ? {} : { details }),
      expose: true,
    });
  }
}

export class PermissionError extends AppError {
  public constructor(message = 'Você não tem permissão para executar esta ação.') {
    super(message, { code: 'PERMISSION_DENIED', expose: true });
  }
}

export class RateLimitError extends AppError {
  public constructor(public readonly retryAfterMs: number) {
    super('Muitas solicitações. Tente novamente em alguns instantes.', {
      code: 'RATE_LIMITED',
      details: { retryAfterMs },
      expose: true,
      retryable: true,
    });
  }
}

export class DatabaseError extends AppError {
  public constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { ...options, code: options.code ?? 'DATABASE_ERROR' });
  }
}

export class ExternalServiceError extends AppError {
  public constructor(service: string, message: string, options: AppErrorOptions = {}) {
    super(message, {
      ...options,
      code: options.code ?? 'EXTERNAL_SERVICE_ERROR',
      details: { service, ...options.details },
    });
  }
}
