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
    const round = {
      instanceId: command.instanceId,
      runtime: command.runtime,
      now: startedAt,
    };
    const begun = await this.beginRound.execute(round);
    const instance = begun.instance;
    const definition = begun.definition;
    const recorded: RecordedAnswer[] = [];
    let deferred = 0;
    let now = startedAt;

    for (
      let work = instance.pendingWork(definition, command.runtime, now);
      !work.isEmpty();
      work = instance.pendingWork(definition, command.runtime, now)
    ) {
      // Each answer is recorded at the time it arrived.
      for await (const answer of this.answers.inArrivalOrder(work)) {
        now = this.clock.now();
        instance.record(answer.results, definition, command.runtime, now);
        recorded.push({ results: answer.results, at: now });
        deferred += answer.deferred;
      }

      // A pass with calls or processes ends the round, which saves before the next one.
      if (work.endsRound()) break;
    }

    const nothingRecorded = recorded.length === 0;

    if (nothingRecorded) {
      const progress = instance.progress(now);
      return { progress, deferred };
    }

    const progress = await this.recordRound.execute({
      instanceId: command.instanceId,
      round: instance.rounds,
      runtime: command.runtime,
      now,
      definition,
      recorded,
    });
    return { progress, deferred };
  }
}
