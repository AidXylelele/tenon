import { Injectable } from "@nestjs/common";
import {
  type Attributes,
  type Link,
  propagation,
  ROOT_CONTEXT,
  type Span,
  SpanKind,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import type { AsyncApiOutcome, JsonObject } from "interpreter";
import { Instrumentation } from "../opentelemetry/enums.js";
import type { BrokerTarget } from "./interfaces.js";

@Injectable()
export class BrokerTracer {
  private static readonly SEND = "send";
  private static readonly PROCESS = "process";

  private readonly tracer = trace.getTracer(Instrumentation.Scope);

  sending(
    target: BrokerTarget,
    system: string,
    publish: () => Promise<AsyncApiOutcome>,
  ): Promise<AsyncApiOutcome> {
    const name = `${BrokerTracer.SEND} ${target.address}`;
    const attributes = this.#attributesOf(target, system, BrokerTracer.SEND);
    const options = { kind: SpanKind.PRODUCER, attributes };
    return this.tracer.startActiveSpan(name, options, (span) =>
      this.#sent(span, publish),
    );
  }

  processing(
    target: BrokerTarget,
    system: string,
    headers: JsonObject,
    deliver: () => Promise<void>,
  ): Promise<void> {
    const name = `${BrokerTracer.PROCESS} ${target.address}`;
    const attributes = this.#attributesOf(target, system, BrokerTracer.PROCESS);
    const links = this.#linksOf(headers);
    const options = { kind: SpanKind.CONSUMER, attributes, links };
    return this.tracer.startActiveSpan(name, options, (span) =>
      this.#processed(span, deliver),
    );
  }

  async #sent(
    span: Span,
    publish: () => Promise<AsyncApiOutcome>,
  ): Promise<AsyncApiOutcome> {
    try {
      const outcome = await publish();

      if (outcome.kind !== "published") this.#failed(span, outcome.kind);

      return outcome;
    } catch (error) {
      this.#thrown(span, error);
      throw error;
    } finally {
      span.end();
    }
  }

  async #processed(span: Span, deliver: () => Promise<void>): Promise<void> {
    try {
      await deliver();
    } catch (error) {
      this.#thrown(span, error);
      throw error;
    } finally {
      span.end();
    }
  }

  #linksOf(headers: JsonObject): Link[] {
    const produced = propagation.extract(ROOT_CONTEXT, headers);
    const link = trace.getSpanContext(produced);

    if (link === undefined) return [];

    return [{ context: link }];
  }

  #attributesOf(
    target: BrokerTarget,
    system: string,
    operation: string,
  ): Attributes {
    return {
      "messaging.system": system,
      "messaging.operation.name": operation,
      "messaging.operation.type": operation,
      "messaging.destination.name": target.address,
    };
  }

  #failed(span: Span, kind: string): void {
    span.setAttribute("error.type", kind);
    span.setStatus({ code: SpanStatusCode.ERROR });
  }

  #thrown(span: Span, error: unknown): void {
    const exception = error instanceof Error ? error : String(error);
    span.recordException(exception);
    span.setStatus({ code: SpanStatusCode.ERROR });
  }
}
