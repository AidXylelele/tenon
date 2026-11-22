import type {
  Attributes,
  Histogram,
  Meter,
  Span,
  Tracer,
} from "@opentelemetry/api";
import type { Step, WorkflowIdentity } from "../api/index.js";
import { CompilePhases } from "./compile-phases.js";
import { secondsSince } from "./elapsed.js";
import { errorTypeOf, failed } from "./failures.js";
import {
  attributeKeys,
  callBuckets,
  lifetimeBuckets,
  metricNames,
  spanNames,
  transitionBuckets,
} from "./names.js";
import type {
  CompileSubject,
  Compiled,
  Operation,
  PhaseTiming,
  Played,
  StepMeasure,
} from "./types.js";

export class Telemetry {
  static readonly scope = "interpreter";

  readonly #tracer: Tracer;
  readonly #compileDuration: Histogram;
  readonly #stepDuration: Histogram;
  readonly #stepTransitions: Histogram;
  readonly #runDuration: Histogram;

  constructor(tracer: Tracer, meter: Meter) {
    this.#tracer = tracer;
    this.#compileDuration = meter.createHistogram(metricNames.compileDuration, {
      unit: "s",
      description: "The time a compilation phase takes.",
      advice: { explicitBucketBoundaries: callBuckets },
    });
    this.#stepDuration = meter.createHistogram(metricNames.stepDuration, {
      unit: "s",
      description: "The time a program call takes to run the machine.",
      advice: { explicitBucketBoundaries: callBuckets },
    });
    this.#stepTransitions = meter.createHistogram(metricNames.stepTransitions, {
      unit: "{transition}",
      description: "The machine transitions a program call takes.",
      advice: { explicitBucketBoundaries: transitionBuckets },
    });
    this.#runDuration = meter.createHistogram(metricNames.runDuration, {
      unit: "s",
      description: "The time from a run's start to the call that ends it.",
      advice: { explicitBucketBoundaries: lifetimeBuckets },
    });
  }

  compile<T extends Compiled>(
    subject: CompileSubject,
    work: (phases: CompilePhases) => T,
  ): T {
    const subjectAttributes = { [attributeKeys.compileSubject]: subject };
    const options = { attributes: subjectAttributes };
    const span = this.#tracer.startSpan(spanNames.compile, options);
    const phases = new CompilePhases(this.#tracer, span);

    try {
      const compiled = work(phases);
      const outcome = compiled.kind;
      const attributes = {
        ...subjectAttributes,
        [attributeKeys.compileOutcome]: outcome,
      };
      span.setAttribute(attributeKeys.compileOutcome, outcome);
      this.#phasesRecorded(phases.timings, attributes);
      return compiled;
    } catch (error) {
      const type = errorTypeOf(error);
      const attributes = {
        ...subjectAttributes,
        [attributeKeys.errorType]: type,
      };
      failed(span, error);
      this.#phasesRecorded(phases.timings, attributes);
      throw error;
    } finally {
      span.end();
    }
  }

  play(
    operation: Operation,
    identity: WorkflowIdentity,
    work: () => Played,
  ): Step {
    const name = spanNames[operation];
    const attributes = this.#callAttributesOf(operation, identity);
    const options = { attributes };
    const span = this.#tracer.startSpan(name, options);
    const operated = { [attributeKeys.operation]: operation };
    const started = performance.now();

    try {
      const played = work();
      const seconds = secondsSince(started);
      this.#annotated(span, played.measure);
      this.#callRecorded(operated, seconds, played.measure);
      return played.step;
    } catch (error) {
      const seconds = secondsSince(started);
      const type = errorTypeOf(error);
      const failure = { ...operated, [attributeKeys.errorType]: type };
      failed(span, error);
      this.#stepDuration.record(seconds, failure);
      throw error;
    } finally {
      span.end();
    }
  }

  #phasesRecorded(
    timings: readonly PhaseTiming[],
    attributes: Attributes,
  ): void {
    for (const timing of timings) {
      const phased = {
        ...attributes,
        [attributeKeys.compilePhase]: timing.phase,
      };
      this.#compileDuration.record(timing.seconds, phased);
    }
  }

  #callAttributesOf(
    operation: Operation,
    identity: WorkflowIdentity,
  ): Attributes {
    return {
      [attributeKeys.operation]: operation,
      [attributeKeys.workflowNamespace]: identity.namespace,
      [attributeKeys.workflowName]: identity.name,
      [attributeKeys.workflowVersion]: identity.version,
    };
  }

  #annotated(span: Span, measure: StepMeasure): void {
    span.setAttributes({
      [attributeKeys.instance]: measure.instance,
      [attributeKeys.runStatus]: measure.status,
      [attributeKeys.transitions]: measure.transitions,
      [attributeKeys.fibers]: measure.fibers,
      [attributeKeys.effectsRequested]: measure.requested,
      [attributeKeys.events]: measure.events,
    });
  }

  #callRecorded(
    operated: Attributes,
    seconds: number,
    measure: StepMeasure,
  ): void {
    const status = { ...operated, [attributeKeys.runStatus]: measure.status };
    this.#stepDuration.record(seconds, status);
    this.#stepTransitions.record(measure.transitions, operated);

    if (measure.lifetime === null) {
      return;
    }

    const ended = { [attributeKeys.runStatus]: measure.status };
    this.#runDuration.record(measure.lifetime, ended);
  }
}
