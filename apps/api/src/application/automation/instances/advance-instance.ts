import { Injectable } from '@nestjs/common';
import { RoundResults } from '../../../domain/automation/language/round-results.js';
import {
  Clock,
  ExpressionEvaluator,
  SchemaValidator,
} from '../language/ports.js';
import { BeginRound } from './begin-round.js';
import {
  type AdvancedInstanceResult,
  type AdvanceInstanceCommand,
  ProcessRunner,
  ServiceCaller,
} from './ports.js';
import { RecordRound } from './record-round.js';

@Injectable()
export class AdvanceInstance {
  constructor(
    private readonly beginRound: BeginRound,
    private readonly recordRound: RecordRound,
    private readonly expressions: ExpressionEvaluator,
    private readonly schemas: SchemaValidator,
    private readonly services: ServiceCaller,
    private readonly processes: ProcessRunner,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: AdvanceInstanceCommand,
  ): Promise<AdvancedInstanceResult> {
    const now = this.clock.now();
    const round = {
      instanceId: command.instanceId,
      runtime: command.runtime,
      now,
    };
    const begun = await this.beginRound.execute(round);
    const instance = begun.instance;
    const definition = begun.definition;
    const recorded: RoundResults[] = [];
    let deferred = 0;

    for (
      let work = instance.pendingWork(definition, command.runtime, now);
      !work.isEmpty();
      work = instance.pendingWork(definition, command.runtime, now)
    ) {
      const computations = [
        this.expressions.evaluateAll(work.evaluations),
        this.schemas.validateAll(work.validations),
        this.services.callAll(work.calls),
        this.processes.runAll(work.processes),
      ] as const;
      const [evaluated, validated, responses, processes] =
        await Promise.all(computations);
      const results = new RoundResults({
        evaluated,
        validated,
        responses,
        processes,
      });
      instance.record(results, definition, command.runtime, now);
      recorded.push(results);
      // Only a pass with calls or processes can defer work, and such a pass ends the round.
      deferred = results.deferredIn(work);

      if (work.endsRound()) break;
    }

    const nothingRecorded = recorded.length === 0;

    if (nothingRecorded) {
      const progress = instance.progress(now);
      return { progress, deferred };
    }

    const progress = await this.recordRound.execute({
      instanceId: command.instanceId,
      runtime: command.runtime,
      now,
      definition,
      recorded,
    });
    return { progress, deferred };
  }
}
