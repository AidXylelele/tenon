import { Injectable } from "@nestjs/common";
import type { AcceptedEvent } from "../../application/automation/events/interfaces.js";
import type { SubscriptionFilters } from "../../application/automation/subscriptions/ports.js";
import type { DefinitionProblem } from "../../application/automation/workflows/interfaces.js";
import type { JsonObject } from "../../domain/automation/interfaces.js";
import type { Subscription } from "../../domain/automation/subscriptions/subscription.js";
import type { Result } from "../../domain/interfaces.js";
import { InterpreterClient } from "./interfaces.js";
import { DefinitionMapper } from "./mappers/definition.mapper.js";
import { ProtocolMapper } from "./mappers/protocol.mapper.js";

@Injectable()
export class InterpreterFilterGateway implements SubscriptionFilters {
  private static readonly NO_FAILURES: ReadonlyMap<string, string> = new Map();

  constructor(
    private readonly client: InterpreterClient,
    private readonly protocol: ProtocolMapper,
    private readonly definitions: DefinitionMapper,
  ) {}

  async check(
    filter: JsonObject,
  ): Promise<Result<void, readonly DefinitionProblem[]>> {
    const source = this.protocol.toObject(filter);
    const checked = await this.client.filter(source);

    if (checked.kind === "compiled") return { ok: true, value: undefined };

    const problems = this.definitions.toProblems(
      checked.diagnostics,
      InterpreterFilterGateway.NO_FAILURES,
    );
    return { ok: false, failure: problems };
  }

  async matching(
    subscriptions: readonly Subscription[],
    event: AcceptedEvent,
    signal: AbortSignal,
  ): Promise<Subscription[]> {
    if (subscriptions.length === 0) return [];

    const filters = subscriptions.map((subscription) => ({
      name: subscription.id,
      filter: this.protocol.toObject(subscription.filter),
    }));
    const offered = this.protocol.toCloudEvent(event.cloudEvent);
    const accepted = await this.client.accepting(filters, offered, signal);
    return subscriptions.filter((subscription) =>
      accepted.includes(subscription.id),
    );
  }
}
