import { Injectable } from '@nestjs/common';
import { WorkflowSchedules } from '@nestjs/workflows';
import type { CronClient } from '../runtime/interfaces.js';

// The engine's own reading of a cron: a preview of the spec stores nothing, and refuses with a
// TypeError what its schedules would refuse.
@Injectable()
export class EngineCronClient implements CronClient {
  private static readonly UTC = 'UTC';

  constructor(private readonly schedules: WorkflowSchedules) {}

  async problemOf(cron: string): Promise<string | null> {
    try {
      await this.schedules.preview(
        { cron, tz: EngineCronClient.UTC },
        { count: 1 },
      );
      return null;
    } catch (error) {
      if (error instanceof TypeError) return error.message;

      throw error;
    }
  }
}
