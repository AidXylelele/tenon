import { Injectable } from "@nestjs/common";
import {
  ResilienceError,
  type ResiliencePolicy,
  ResilienceService,
  ResilienceTimeoutError,
} from "@nestjs/resilience";
import { createParser } from "eventsource-parser";
import type {
  A2aRequest,
  Endpoint,
  HttpRequest,
  JsonObject,
  JsonValue,
  RpcOutcome,
} from "interpreter";
import { HttpClient } from "../http-client/http.client.js";
import type { CallContext } from "../interpreter/interfaces.js";
import { AgentCard } from "./agent-card.js";
import { AGENT_CARD } from "./agent-card.schema.js";
import type { Agent, Responded } from "./interfaces.js";
import { JSON_RPC_RESPONSE } from "./json-rpc.schema.js";

const UNFIT = "The agent answered other than JSON-RPC";

@Injectable()
export class A2aClient {
  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly http: HttpClient,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("a2a-calls");
  }

  async call(request: A2aRequest, context: CallContext): Promise<RpcOutcome> {
    const agent = await this.#agentOf(request.agent, context);

    if (agent.kind !== "agent") return agent;

    const streamed = this.#streams(request);
    const rpc = this.#rpcOf(request, agent.endpoint, context.idempotencyKey);

    try {
      return await this.policy.execute(
        (attempt) => this.#answered(rpc, streamed, context, attempt.signal),
        { signal: context.signal },
      );
    } catch (error) {
      return this.#failureOf(error, context.signal);
    }
  }

  async #agentOf(
    agent: A2aRequest["agent"],
    context: CallContext,
  ): Promise<Agent> {
    if (agent.kind === "server")
      return { kind: "agent", endpoint: agent.endpoint };

    const card = await this.http.text(agent.card, context);

    if (card.kind !== "text") return card;

    const parsed = this.#cardOf(card.text);

    if (parsed === null)
      return { kind: "misconfigured", detail: "The agent card cannot be read" };

    const endpoint = agent.card.endpoint;
    return parsed.jsonRpcEndpoint(endpoint.authentication, endpoint.uri);
  }

  async #answered(
    rpc: HttpRequest,
    streamed: boolean,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<RpcOutcome> {
    const response = await this.http.exchange(rpc, context, signal);

    if (response.kind !== "responded") return response;

    return this.#outcomeOf(response, streamed);
  }

  #rpcOf(
    request: A2aRequest,
    endpoint: Endpoint,
    idempotencyKey: string,
  ): HttpRequest {
    const accept = this.#streams(request)
      ? "text/event-stream"
      : "application/json";
    return {
      kind: "http",
      method: "POST",
      endpoint,
      headers: { accept },
      body: this.#envelopeOf(request, idempotencyKey),
      output: "content",
      revealAuthorization: false,
    };
  }

  #envelopeOf(request: A2aRequest, id: string): JsonObject {
    const method = request.method;
    const params = request.parameters;

    if (params === null) return { jsonrpc: "2.0", id, method };

    return { jsonrpc: "2.0", id, method, params };
  }

  #outcomeOf(response: Responded, streamed: boolean): RpcOutcome {
    const status = response.statusCode;
    const content = response.content;
    const ok = status >= 200 && status < 300;

    if (streamed && ok && typeof content === "string")
      return this.#eventsOf(content);

    const answer = this.#answerOf(content);

    if (answer.kind === "unreachable" && !ok)
      return {
        kind: "rejected",
        statusCode: status,
        detail: `The agent answered with status ${String(status)}`,
      };

    if (streamed && answer.kind === "answered")
      return { kind: "answered", result: [answer.result] };

    return answer;
  }

  #eventsOf(text: string): RpcOutcome {
    const data: string[] = [];
    const parser = createParser({
      onEvent: (event) => {
        data.push(event.data);
      },
    });
    parser.feed(text);
    parser.reset({ consume: true });
    const answers = data.map((item) => this.#answerOf(this.#parsedOf(item)));
    const failed = answers.find((answer) => answer.kind !== "answered");

    if (failed !== undefined) return failed;

    const results = answers.flatMap((answer) =>
      answer.kind === "answered" ? [answer.result] : [],
    );
    return { kind: "answered", result: results };
  }

  #answerOf(envelope: JsonValue): RpcOutcome {
    const parsed = JSON_RPC_RESPONSE.safeParse(envelope);

    if (!parsed.success) return { kind: "unreachable", detail: UNFIT };

    const answer = parsed.data;

    if ("error" in answer) {
      const { code, message, data } = answer.error;
      return { kind: "rpcError", code, message, data };
    }

    return { kind: "answered", result: answer.result };
  }

  #cardOf(text: string): AgentCard | null {
    const parsed = AGENT_CARD.safeParse(this.#parsedOf(text));
    return parsed.success ? new AgentCard(parsed.data) : null;
  }

  #parsedOf(text: string): JsonValue {
    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return null;
    }
  }

  #streams(request: A2aRequest): boolean {
    return (
      request.method === "message/stream" ||
      request.method === "tasks/resubscribe"
    );
  }

  #failureOf(error: unknown, signal: AbortSignal): RpcOutcome {
    if (signal.aborted || error instanceof ResilienceTimeoutError)
      return { kind: "expired" };

    if (error instanceof ResilienceError) throw error;

    const failure = this.http.transportFailureOf(error);

    if (failure === null) throw error;

    return failure;
  }
}
