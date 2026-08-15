import type { AppLogger } from '../ports/logger.js';

interface Metric {
  count: number;
  totalDurationMs: number;
  maxDurationMs: number;
}

export class MetricsService {
  private readonly metrics = new Map<string, Metric>();

  public constructor(private readonly logger: AppLogger) {}

  public record(name: string, durationMs: number): void {
    const current = this.metrics.get(name) ?? {
      count: 0,
      totalDurationMs: 0,
      maxDurationMs: 0,
    };
    current.count += 1;
    current.totalDurationMs += durationMs;
    current.maxDurationMs = Math.max(current.maxDurationMs, durationMs);
    this.metrics.set(name, current);

    if (durationMs >= 1_000) {
      this.logger.performance('Operação lenta detectada.', durationMs, { operation: name });
    }
  }

  public snapshot(): Readonly<Record<string, Readonly<Metric & { averageDurationMs: number }>>> {
    return Object.fromEntries(
      [...this.metrics.entries()].map(([name, metric]) => [
        name,
        {
          ...metric,
          averageDurationMs: metric.count === 0 ? 0 : metric.totalDurationMs / metric.count,
        },
      ]),
    );
  }
}
