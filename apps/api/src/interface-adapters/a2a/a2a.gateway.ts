import { Injectable } from "@nestjs/common";
import type { A2aRequest, Endpoint, RpcOutcome } from "interpreter";
import { Authenticator } from "../auth/authenticator.js";
import { ResourceGateway } from "../http/resource.gateway.js";
import { TransportFault } from "../http/transport-fault.error.js";
import type { CallContext } from "../interpreter/interfaces.js";
import { AgentCard } from "./agent-card.js";
import {
  A2aClient,
  type A2aReply,
  type Agent,
  type JsonRpcAnswer,
} from "./interfaces.js";

@Injectable()
export class A2aGateway {
  private static readonly STREAMING: readonly string[] = [
    "message/stream",
    "tasks/resubscribe",
  ];

  constructor(
    private readonly client: A2aClient,
    private readonly resources: ResourceGateway,
    private readonly authenticator: Authenticator,
  ) {}

  async perform(
    request: A2aRequest,
    context: CallContext,
  ): Promise<RpcOutcome> {
    const agent = await this.#agentOf(request.agent, context);

    if (agent.kind !== "agent") return agent;

    try {
      return await this.#answered(request, agent.endpoint, context);
    } catch (error) {
      if (error instanceof TransportFault) return error.failure();

      throw error;
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

    const data = this.client.cardOf(fetched.text);

    if (data === null)
      return { kind: "misconfigured", detail: "The agent card cannot be read" };

    const card = new AgentCard(data);
    const endpoint = agent.card.endpoint;
    return card.jsonRpcEndpoint(endpoint.authentication, endpoint.uri);
  }

  async #answered(
    request: A2aRequest,
    endpoint: Endpoint,
    context: CallContext,
  ): Promise<RpcOutcome> {
    const authorization = await this.authenticator.authorizationOf(
      endpoint.authentication,
      context.secrets,
      context.signal,
    );

    if (authorization.kind === "forbidden") return authorization;

    if (authorization.kind === "misconfigured") return authorization;

    const credentials =
      authorization.kind === "header"
        ? this.authenticator.headerValueOf(authorization.header)
        : null;
    const streamed = A2aGateway.STREAMING.includes(request.method);
    const call = {
      uri: endpoint.uri,
      authorization: credentials,
      idempotencyKey: context.idempotencyKey,
      method: request.method,
      params: request.parameters,
      streamed,
    };
    const reply = await this.client.call(call, context.signal);
    return this.#outcomeOf(reply, streamed);
  }

  #outcomeOf(reply: A2aReply, streamed: boolean): RpcOutcome {
    if (reply.events) return this.#eventsOf(reply.answers);

    const [first] = reply.answers;
    const answer = this.#answerOf(first);
    const ok = reply.statusCode >= 200 && reply.statusCode <= 299;
    const refused = !ok && answer.kind === "unreachable";

    if (refused)
      return {
        kind: "rejected",
        statusCode: reply.statusCode,
        detail: `The agent answered with status ${String(reply.statusCode)}`,
      };

    const listed = streamed && answer.kind === "answered";

    if (listed) return { kind: "answered", result: [answer.result] };

    return answer;
  }

  #eventsOf(answers: readonly JsonRpcAnswer[]): RpcOutcome {
    const outcomes = answers.map((answer) => this.#answerOf(answer));
    const failed = outcomes.find((outcome) => outcome.kind !== "answered");

    if (failed !== undefined) return failed;

    const results = outcomes.flatMap((outcome) =>
      outcome.kind === "answered" ? [outcome.result] : [],
    );
    return { kind: "answered", result: results };
  }

  #answerOf(answer: JsonRpcAnswer | undefined): RpcOutcome {
    switch (answer?.kind) {
      case "result":
        return { kind: "answered", result: answer.result };
      case "error":
        return {
          kind: "rpcError",
          code: answer.code,
          message: answer.message,
          data: answer.data,
        };
      case "unspoken":
      case undefined:
        return {
          kind: "unreachable",
          detail: "The agent answered other than JSON-RPC",
        };
    }
  }
}
