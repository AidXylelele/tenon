import { Injectable } from "@nestjs/common";
import {
  type AsyncAPIDocumentInterface,
  type ChannelInterface,
  type Diagnostic,
  type OperationInterface,
  Parser,
  type ServerInterface,
} from "@asyncapi/parser";
import type { AsyncApiRequest, JsonObject, JsonValue } from "interpreter";
import type {
  AsyncApiDocuments,
  BrokerServer,
  Targeted,
} from "../../interface-adapters/asyncapi/interfaces.js";
import { BrokerProtocol } from "./enums.js";

@Injectable()
export class ParserAsyncApiDocuments implements AsyncApiDocuments {
  private static readonly CONTENT_TYPE = "application/json";
  private static readonly SECURE_PROTOCOLS: readonly string[] = [
    BrokerProtocol.Amqps,
    BrokerProtocol.KafkaSecure,
    BrokerProtocol.SecureMqtt,
  ];
  private static readonly SECURE_SCHEMES = [
    "mqtts:",
    "amqps:",
    "rediss:",
    "tls:",
  ];
  private static readonly VARIABLE = /\{([^{}]+)\}/g;

  constructor(private readonly parser: Parser) {}

  async targetOf(text: string, request: AsyncApiRequest): Promise<Targeted> {
    const parsed = await this.parser.parse(text);
    const document = parsed.document;

    if (document === undefined) return this.#invalid(parsed.diagnostics);

    const operation = this.#operationOf(document, request);
    const channel = this.#channelOf(document, operation, request);

    if (channel === undefined)
      return this.#unusable("The document has no such operation or channel");

    return this.#targetOn(document, operation, channel, request);
  }

  #targetOn(
    document: AsyncAPIDocumentInterface,
    operation: OperationInterface | undefined,
    channel: ChannelInterface,
    request: AsyncApiRequest,
  ): Targeted {
    const address = channel.address() ?? "";
    const parameterised = address.includes("{");

    if (address === "" || parameterised)
      return this.#unusable(
        "The channel has no address of its own, or one with parameters the call cannot give",
      );

    const named = this.#serverOf(channel, request);

    if (named === undefined)
      return this.#unusable(
        "No server of the document serves the channel with the protocol asked for",
      );

    const variables = request.server?.variables ?? {};
    const url = this.#urlOf(named, variables);

    if (url === null)
      return this.#unusable(
        "The server's address has a variable the call and the document leave unset, or is no URL",
      );

    const server = this.#brokerOf(named, url);
    const contentType = this.#contentTypeOf(document, operation, channel);
    const bindings = {
      channel: this.#bindingsOf(channel),
      operation: this.#bindingsOf(operation),
    };
    return { kind: "target", server, address, contentType, bindings };
  }

  #operationOf(
    document: AsyncAPIDocumentInterface,
    request: AsyncApiRequest,
  ): OperationInterface | undefined {
    if (request.operation === null) return undefined;

    return document.operations().get(request.operation);
  }

  #channelOf(
    document: AsyncAPIDocumentInterface,
    operation: OperationInterface | undefined,
    request: AsyncApiRequest,
  ): ChannelInterface | undefined {
    if (request.channel !== null)
      return document.channels().get(request.channel);

    const [channel] = operation?.channels().all() ?? [];
    return channel;
  }

  #serverOf(
    channel: ChannelInterface,
    request: AsyncApiRequest,
  ): ServerInterface | undefined {
    const servers = channel.servers();

    if (request.server !== null) return servers.get(request.server.name);

    const protocol = request.protocol;
    const [first] = servers.filterBy((server) => {
      const spoken = server.protocol();
      return protocol === null || spoken === protocol;
    });
    return first;
  }

  #urlOf(server: ServerInterface, variables: JsonObject): URL | null {
    const entries = server
      .variables()
      .all()
      .map((variable) => [variable.id(), variable.defaultValue()] as const);
    const defaults = new Map(entries);
    const declared = server
      .url()
      .replace(ParserAsyncApiDocuments.VARIABLE, (written, name: string) => {
        const fallback = defaults.get(name);
        return this.#variableOf(variables[name], fallback) ?? written;
      });
    const absolute = declared.includes("://");
    const schemed = absolute ? declared : `${server.protocol()}://${declared}`;
    const parameterised = schemed.includes("{");
    const parsable = URL.canParse(schemed);

    if (parameterised || !parsable) return null;

    return new URL(schemed);
  }

  #variableOf(
    given: JsonValue | undefined,
    fallback: string | undefined,
  ): string | undefined {
    if (given === undefined || given === null) return fallback;

    if (typeof given === "string") return given;

    return JSON.stringify(given);
  }

  #brokerOf(server: ServerInterface, url: URL): BrokerServer {
    const protocol = server.protocol();
    const port = url.port === "" ? null : Number(url.port);
    const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1");
    const secure =
      ParserAsyncApiDocuments.SECURE_PROTOCOLS.includes(protocol) ||
      ParserAsyncApiDocuments.SECURE_SCHEMES.includes(url.protocol);
    return {
      url: url.href,
      protocol,
      protocolVersion: server.protocolVersion() ?? null,
      hostname,
      port,
      pathname: url.pathname,
      secure,
    };
  }

  #contentTypeOf(
    document: AsyncAPIDocumentInterface,
    operation: OperationInterface | undefined,
    channel: ChannelInterface,
  ): string {
    const messages = operation?.messages() ?? channel.messages();
    const [message] = messages.all();
    const declared = message?.contentType() ?? document.defaultContentType();
    return declared ?? ParserAsyncApiDocuments.CONTENT_TYPE;
  }

  #bindingsOf(
    bound: ChannelInterface | OperationInterface | undefined,
  ): Readonly<Record<string, unknown>> {
    const bindings: Record<string, unknown> = {};

    for (const binding of bound?.bindings().all() ?? [])
      bindings[binding.protocol()] = binding.value<unknown>();

    return bindings;
  }

  #invalid(diagnostics: readonly Diagnostic[]): Targeted {
    const [worst] = diagnostics.toSorted(
      (left, right) => left.severity - right.severity,
    );
    const reason = worst?.message ?? "it could not be read";
    return this.#unusable(`The AsyncAPI document is not valid: ${reason}`);
  }

  #unusable(detail: string): Targeted {
    return { kind: "unusable", detail };
  }
}
