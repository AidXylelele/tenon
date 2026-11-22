import type { Authentication } from "interpreter";
import type { Agent, AgentCardProperties, AgentOffer } from "./interfaces.js";

export class AgentCard {
  constructor(private readonly properties: AgentCardProperties) {}

  jsonRpcEndpoint(credentials: Authentication | null, cardUri: string): Agent {
    const chosen = this.#offers().find((offer) => {
      const beforeOne = offer.version.startsWith("0.");
      return offer.binding === "JSONRPC" && beforeOne;
    });

    if (chosen === undefined)
      return {
        kind: "misconfigured",
        detail: "The agent card offers no JSON-RPC interface of A2A 0.3",
      };

    const secured = this.#secured();
    const authentication = secured ? credentials : null;
    const foreign =
      authentication !== null &&
      this.#originOf(chosen.url) !== this.#originOf(cardUri);

    if (foreign)
      return {
        kind: "misconfigured",
        detail:
          "The agent card names an agent at another origin, which its credentials are not sent to",
      };

    return { kind: "agent", endpoint: { uri: chosen.url, authentication } };
  }

  #offers(): readonly AgentOffer[] {
    const card = this.properties;
    const version = card.protocolVersion;
    const preferred =
      card.url === null
        ? []
        : [{ url: card.url, binding: card.preferredTransport, version }];
    const additional = card.additionalInterfaces.map((offer) => ({
      url: offer.url,
      binding: offer.transport,
      version,
    }));
    const supported = card.supportedInterfaces.map((offer) => ({
      url: offer.url,
      binding: offer.protocolBinding,
      version: offer.protocolVersion,
    }));
    return preferred.concat(additional, supported);
  }

  #secured(): boolean {
    const card = this.properties;
    return card.security.length > 0 || card.securityRequirements.length > 0;
  }

  #originOf(uri: string): string | null {
    const parsable = URL.canParse(uri);
    return parsable ? new URL(uri).origin : null;
  }
}
