import { Injectable } from "@nestjs/common";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import { createParser } from "eventsource-parser";
import type {
  A2aRequest,
  Endpoint,
  JsonObject,
  JsonValue,
  RpcOutcome,
} from "interpreter";
import { ResourceGateway } from "../../http/resource.gateway.js";
import { AgentCard } from "./agent-card.js";
import { AGENT_CARD } from "./agent-card.schema.js";
import { Authenticator } from "../../auth/authenticator.js";
import { OutboundHttpClient } from "../../../frameworks/http/outbound.http-client.js";
import type { Agent, CallContext } from "./interfaces.js";
import { JSON_RPC_RESPONSE } from "./json-rpc.schema.js";
import { ResponseContent } from "../../../frameworks/http/response-content.js";
import { TransportFaults } from "../../../frameworks/http/transport-faults.js";

@Injectable()
export class A2aGateway {
  private static readonly EVENT_STREAM = "text/event-stream";

  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly resources: ResourceGateway,
    private readonly http: OutboundHttpClient,
    private readonly authenticator: Authenticator,
    private readonly content: ResponseContent,
    private readonly failures: TransportFaults,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("a2a-calls");
  }

  async perform(
    request: A2aRequest,
    context: CallContext,
  ): Promise<RpcOutcome> {
    const agent = await this.#agentOf(request.agent, context);

    if (agent.kind !== "agent") return agent;

    const endpoint = agent.endpoint;

    try {
      return await this.policy.execute(
        (attempt) => this.#answered(request, endpoint, context, attempt.signal),
        { signal: context.signal },
      );
    } catch (error) {
      return this.failures.of(error, context.signal).failure();
    }
  }

  async #agentOf(
    agent: A2aRequest["agent"],
    context: CallContext,
  ): Promise<Agent> {
    if (agent.kind === "server")
      return { kind: "agent", endpoint: agent.endpoint };

    const fetched = await this.resources.text(agent.card, context);

    if (fetched.kind !== "text") return fetched;

    const card = this.#cardOf(fetched.text);

    if (card === null)
      return { kind: "misconfigured", detail: "The agent card cannot be read" };

    const endpoint = agent.card.endpoint;
    return card.jsonRpcEndpoint(endpoint.authentication, endpoint.uri);
  }

  async #answered(
    request: A2aRequest,
    endpoint: Endpoint,
    context: CallContext,
    signal: AbortSignal,
  ): Promise<RpcOutcome> {
    const authorization = await this.authenticator.authorizationOf(
      endpoint.authentication,
      context.secrets,
      signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const streamed = this.#streams(request);
    const headers = this.#headersOf(streamed, context.idempotencyKey);

    if (authorization.kind === "header") {
      const value = this.authenticator.headerValueOf(authorization.header);
      headers.set("authorization", value);
    }

    const envelope = this.#envelopeOf(request, context.idempotencyKey);
    const body = JSON.stringify(envelope);
    const response = await this.http.fetch(endpoint.uri, {
      method: "POST",
      headers,
      body,
      signal,
    });
    const text = await this.content.textOf(response);
    return this.#outcomeOf(response, text, streamed);
  }

  #headersOf(streamed: boolean, idempotencyKey: string): Headers {
    const accept = streamed ? A2aGateway.EVENT_STREAM : "application/json";
    return new Headers({
      accept,
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
    });
  }

  #envelopeOf(request: A2aRequest, id: string): JsonObject {
    const method = request.method;
    const params = request.parameters;

    if (params === null) return { jsonrpc: "2.0", id, method };

    return { jsonrpc: "2.0", id, method, params };
  }

  #outcomeOf(response: Response, text: string, streamed: boolean): RpcOutcome {
    const status = response.status;
    const eventStream = this.#isEventStream(response, text);
    const events = streamed && response.ok && eventStream;

    if (events) return this.#eventsOf(text);

    const envelope = this.#parsedOf(text);
    const answer = this.#answerOf(envelope);
    const refused = !response.ok && answer.kind === "unreachable";

    if (refused)
      return {
        kind: "rejected",
        statusCode: status,
        detail: `The agent answered with status ${String(status)}`,
      };

    const listed = streamed && answer.kind === "answered";

    if (listed) return { kind: "answered", result: [answer.result] };

    return answer;
  }

  #isEventStream(response: Response, text: string): boolean {
    const media = this.content.mediaOf(response);

    if (media === null) {
      const json = this.#isJson(text);
      return text !== "" && !json;
    }

    return media.essence === A2aGateway.EVENT_STREAM;
  }

  #isJson(text: string): boolean {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }

  #eventsOf(text: string): RpcOutcome {
    const data = this.#eventDataOf(text);
    const answers = data.map((item) => {
      const envelope = this.#parsedOf(item);
      return this.#answerOf(envelope);
    });
    const failed = answers.find((answer) => answer.kind !== "answered");

    if (failed !== undefined) return failed;

    const results = answers.flatMap((answer) =>
      answer.kind === "answered" ? [answer.result] : [],
    );
    return { kind: "answered", result: results };
  }

  #eventDataOf(text: string): readonly string[] {
    const data: string[] = [];
    const parser = createParser({
      onEvent: (event) => {
        data.push(event.data);
      },
    });
    parser.feed(text);
    parser.reset({ consume: true });
    return data;
  }

  #answerOf(envelope: JsonValue): RpcOutcome {
    const parsed = JSON_RPC_RESPONSE.safeParse(envelope);

    if (!parsed.success)
      return {
        kind: "unreachable",
        detail: "The agent answered other than JSON-RPC",
      };

    const answer = parsed.data;

    if ("error" in answer) {
      const { code, message, data } = answer.error;
      return { kind: "rpcError", code, message, data };
    }

    return { kind: "answered", result: answer.result };
  }

  #cardOf(text: string): AgentCard | null {
    const document = this.#parsedOf(text);
    const parsed = AGENT_CARD.safeParse(document);

    if (!parsed.success) return null;

    return new AgentCard(parsed.data);
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
}
