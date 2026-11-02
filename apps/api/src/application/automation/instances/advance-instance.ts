import { Injectable } from '@nestjs/common';
import { Clock } from '../language/ports.js';
import { BeginRound } from './begin-round.js';
import type {
  AdvancedInstanceResult,
  AdvanceInstanceCommand,
  RecordedAnswer,
} from './ports.js';
import { RecordRound } from './record-round.js';
import { WorkAnswers } from './work-answers.js';

@Injectable()
export class AdvanceInstance {
  constructor(
    private readonly beginRound: BeginRound,
    private readonly recordRound: RecordRound,
    private readonly answers: WorkAnswers,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: AdvanceInstanceCommand,
  ): Promise<AdvancedInstanceResult> {
    const startedAt = this.clock.now();
    const begun = await this.beginRound.execute({
      instanceId: command.instanceId,
      runtime: command.runtime,
      now: startedAt,
    });
    const instance = begun.instance;
    const recorded: RecordedAnswer[] = [];
    let context = begun.context;
    let deferred = 0;

    for (
      let work = instance.pendingWork(context);
      !work.isEmpty();
      work = instance.pendingWork(context)
    ) {
      // Each answer is recorded at the time it arrived.
      for await (const answer of this.answers.inArrivalOrder(work)) {
        const arrivedAt = this.clock.now();
        context = context.at(arrivedAt);
        instance.record(answer.results, context);
        recorded.push({ results: answer.results, at: arrivedAt });
        deferred += answer.deferred;
      }

      // A pass with calls or processes ends the round, which saves before the next one.
      if (work.endsRound()) break;
    }

    const nothingRecorded = recorded.length === 0;

    if (nothingRecorded) {
      const progress = instance.progress(context.now);
      return { progress, deferred };
    }

    const progress = await this.recordRound.execute({
      instanceId: command.instanceId,
      round: instance.rounds,
      context,
      recorded,
    });
    return { progress, deferred };
  }
}
