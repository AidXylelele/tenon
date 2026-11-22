import {
  type Context,
  type Span,
  type Tracer,
  context,
  trace,
} from "@opentelemetry/api";
import { secondsSince } from "./elapsed.js";
import { failed } from "./failures.js";
import { spanNames } from "./names.js";
import type { CompilePhase, PhaseTiming } from "./types.js";

export class CompilePhases {
  readonly #tracer: Tracer;
  readonly #parent: Context;
  readonly #timings: PhaseTiming[] = [];

  constructor(tracer: Tracer, compile: Span) {
    const active = context.active();

    this.#tracer = tracer;
    this.#parent = trace.setSpan(active, compile);
  }

  get timings(): readonly PhaseTiming[] {
    return this.#timings;
  }

  analyze<T>(work: () => T): T {
    return this.#timed("analyze", work);
  }

  translate<T>(work: () => T): T {
    return this.#timed("translate", work);
  }

  #timed<T>(phase: CompilePhase, work: () => T): T {
    const name = spanNames[phase];
    const span = this.#tracer.startSpan(name, {}, this.#parent);
    const started = performance.now();

    try {
      return work();
    } catch (error) {
      failed(span, error);
      throw error;
    } finally {
      const seconds = secondsSince(started);
      this.#timings.push({ phase, seconds });
      span.end();
    }
  }
}
