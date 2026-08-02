import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RunRecord } from './run.types';

@Injectable()
export class AnalysisRunsService {
  private readonly logger = new Logger(AnalysisRunsService.name);
  private readonly runs = new Map<string, RunRecord>();

  start(
    type: string,
    input: Record<string, any>,
    task: () => Promise<string>,
  ): RunRecord {
    const now = new Date().toISOString();
    const record: RunRecord = {
      id: randomUUID(),
      type,
      input,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(record.id, record);

    task()
      .then((result) => {
        record.status = 'completed';
        record.result = result;
        record.updatedAt = new Date().toISOString();
      })
      .catch((error) => {
        this.logger.error(
          `Run ${record.id} (${type}) failed: ${error.message}`,
        );
        record.status = 'failed';
        record.error = error.message;
        record.updatedAt = new Date().toISOString();
      });

    return record;
  }

  get(id: string): RunRecord | undefined {
    return this.runs.get(id);
  }

  /**
   * True if a run of the given type is currently pending, optionally
   * narrowed by a predicate over the run's input. No time window — a
   * pending run is transient by nature, unlike the day/month-scale
   * freshness checks that guard against re-running finished work.
   */
  hasPendingRun(
    type: string,
    matcher: (input: Record<string, any>) => boolean = () => true,
  ): boolean {
    return Array.from(this.runs.values()).some(
      (run) =>
        run.type === type && run.status === 'pending' && matcher(run.input),
    );
  }

  hasPendingRunToday(type: string, ticker: string): boolean {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    return Array.from(this.runs.values()).some(
      (run) =>
        run.type === type &&
        run.status === 'pending' &&
        run.input.ticker === ticker &&
        run.createdAt >= startOfDay.toISOString() &&
        run.createdAt < endOfDay.toISOString(),
    );
  }

  list(type?: string): RunRecord[] {
    const all = Array.from(this.runs.values());
    const filtered = type ? all.filter((run) => run.type === type) : all;
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
