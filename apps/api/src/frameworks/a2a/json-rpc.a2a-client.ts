import { Injectable } from "@nestjs/common";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import { createParser } from "eventsource-parser";
import type { JsonObject, JsonValue } from "interpreter";
import type {
  A2aCall,
  A2aClient,
  A2aReply,
  AgentCardData,
  JsonRpcAnswer,
} from "../../interface-adapters/a2a/interfaces.js";
import { UndiciHttpClient } from "../http/undici.http-client.js";
import { ResponseContent } from "../http/response-content.js";
import { TransportFaults } from "../http/transport-faults.js";
import { AGENT_CARD } from "./agent-card.schema.js";
import { JSON_RPC_RESPONSE } from "./json-rpc.schema.js";

@Injectable()
export class JsonRpcA2aClient implements A2aClient {
  private static readonly EVENT_STREAM = "text/event-stream";

  private readonly policy: ResiliencePolicy;

  constructor(
    private readonly http: UndiciHttpClient,
    private readonly content: ResponseContent,
    private readonly faults: TransportFaults,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("a2a-calls");
  }

  cardOf(text: string): AgentCardData | null {
    const document = this.#parsedOf(text);
    const parsed = AGENT_CARD.safeParse(document);
    return parsed.success ? parsed.data : null;
  }

  async call(call: A2aCall, signal: AbortSignal): Promise<A2aReply> {
    try {
      return await this.policy.execute(
        (attempt) => this.#called(call, attempt.signal),
        { signal },
      );
    } catch (error) {
      throw this.faults.of(error, signal);
    }
  }

  async #called(call: A2aCall, signal: AbortSignal): Promise<A2aReply> {
    const headers = this.#headersOf(call);
    const envelope = this.#envelopeOf(call);
    const body = JSON.stringify(envelope);
    const response = await this.http.fetch(call.uri, {
      method: "POST",
      headers,
      body,
      signal,
    });
    const text = await this.content.textOf(response);
    const eventStream = this.#isEventStream(response, text);
    const events = call.streamed && response.ok && eventStream;
    const answers = events
      ? this.#eventDataOf(text).map((data) => this.#answerOf(data))
      : [this.#answerOf(text)];
    return { statusCode: response.status, events, answers };
  }

  #headersOf(call: A2aCall): Headers {
    const accept = call.streamed
      ? JsonRpcA2aClient.EVENT_STREAM
      : "application/json";
    const headers = new Headers({
      accept,
      "content-type": "application/json",
      "idempotency-key": call.idempotencyKey,
    });

    if (call.authorization !== null)
      headers.set("authorization", call.authorization);

    return headers;
  }

  #envelopeOf(call: A2aCall): JsonObject {
    const id = call.idempotencyKey;
    const method = call.method;
    const params = call.params;

    if (params === null) return { jsonrpc: "2.0", id, method };

    return { jsonrpc: "2.0", id, method, params };
  }

  #isEventStream(response: Response, text: string): boolean {
    const media = this.content.mediaOf(response);

    if (media === null) {
      const json = this.#isJson(text);
      return text !== "" && !json;
    }

    return media.essence === JsonRpcA2aClient.EVENT_STREAM;
  }

  #isJson(text: string): boolean {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
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

  #answerOf(text: string): JsonRpcAnswer {
    const envelope = this.#parsedOf(text);
    const parsed = JSON_RPC_RESPONSE.safeParse(envelope);

    if (!parsed.success) return { kind: "unspoken" };

    const answer = parsed.data;

    if ("error" in answer) {
      const { code, message, data } = answer.error;
      return { kind: "error", code, message, data };
    }

    return { kind: "result", result: answer.result };
  }

  #parsedOf(text: string): JsonValue {
    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return null;
    }
  }
}
