import { Injectable } from "@nestjs/common";
import type {
  AsyncApiOutcome,
  AsyncApiRequest,
  Authentication,
  Failure,
  JsonObject,
} from "interpreter";
import { Authenticator } from "../auth/authenticator.js";
import type { BasicCredentials, UnusableSecret } from "../auth/interfaces.js";
import { ResourceGateway } from "../http/resource.gateway.js";
import { TransportFault } from "../http/transport-fault.error.js";
import type { CallContext, StepCall } from "../interpreter/interfaces.js";
import {
  AsyncApiDocuments,
  type AsyncApiInbox,
  BrokerClient,
  type BrokerInbox,
  type BrokerTarget,
  type Subscribed,
} from "./interfaces.js";

@Injectable()
export class AsyncApiGateway {
  constructor(
    private readonly resources: ResourceGateway,
    private readonly authenticator: Authenticator,
    private readonly documents: AsyncApiDocuments,
    private readonly brokers: BrokerClient,
  ) {}

  async perform(
    request: AsyncApiRequest,
    context: CallContext,
  ): Promise<AsyncApiOutcome> {
    const exchange = request.exchange;

    if (exchange.kind === "receive")
      throw new Error(
        "A receive is a wait of the run that the host's receivers answer",
      );

    const target = await this.#targetOf(request, context);

    if (target.kind !== "target") return target;

    const login = this.#loginOf(request.authentication, context.secrets);

    if (login !== null && login.kind !== "basic") return login;

    const message = {
      payload: exchange.message.payload,
      contentType: target.contentType,
      headers: exchange.message.headers,
      idempotencyKey: context.idempotencyKey,
      login,
    };

    try {
      await this.brokers.publish(target, message, context.signal);
      return { kind: "published" };
    } catch (error) {
      if (error instanceof TransportFault) return error.failure();

      throw error;
    }
  }

  async subscribe(
    request: AsyncApiRequest,
    step: StepCall,
    inbox: AsyncApiInbox,
  ): Promise<Subscribed> {
    const target = await this.#targetOf(request, step);

    if (target.kind !== "target") return target;

    const login = this.#loginOf(request.authentication, step.secrets);

    if (login !== null && login.kind !== "basic") return login;

    const brokerInbox = this.#brokerInboxOf(step, inbox);

    try {
      const subscription = await this.brokers.subscribe(
        target,
        login,
        brokerInbox,
      );
      return { kind: "subscribed", subscription };
    } catch (error) {
      if (error instanceof TransportFault) return error.failure();

      throw error;
    }
  }

  async #targetOf(
    request: AsyncApiRequest,
    step: StepCall,
  ): Promise<BrokerTarget | Failure> {
    const document = await this.resources.text(request.document, step);

    if (document.kind !== "text") return document;

    const target = await this.documents.targetOf(document.text, request);

    if (target.kind === "unusable")
      return { kind: "misconfigured", detail: target.detail };

    return target;
  }

  #brokerInboxOf(step: StepCall, inbox: AsyncApiInbox): BrokerInbox {
    return {
      subscriber: step.idempotencyKey,
      ended: inbox.ended,
      demanded: () => inbox.demanded(),
      deliver: (message) => inbox.message(message),
      refuse: (detail) => {
        const refused: Failure = { kind: "misconfigured", detail };
        return inbox.failure(refused);
      },
      lost: () => {
        inbox.lost();
      },
    };
  }

  #loginOf(
    authentication: Authentication | null,
    secrets: JsonObject,
  ): BasicCredentials | UnusableSecret | null {
    const credentials = this.authenticator.credentialsOf(
      authentication,
      secrets,
    );

    if (credentials === null) return null;

    switch (credentials.kind) {
      case "forbidden":
      case "misconfigured":
      case "basic":
        return credentials;
      case "bearer":
      case "oauth2":
      case "oidc":
        return {
          kind: "misconfigured",
          detail: "A broker is authenticated with basic credentials only",
        };
    }
  }
}
