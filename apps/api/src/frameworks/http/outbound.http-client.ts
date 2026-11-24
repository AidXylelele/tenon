import { Injectable } from "@nestjs/common";
import {
  InjectHttpClient,
  HttpClient as NestHttpClient,
} from "@nestjs/http-client";
import { type ResiliencePolicy, ResilienceService } from "@nestjs/resilience";
import type { BodyReading } from "../../interface-adapters/http/enums.js";
import type {
  HttpClient,
  HttpReply,
  OutboundRequest,
  TextReply,
} from "../../interface-adapters/http/interfaces.js";
import { AddressPolicy } from "./address-policy.js";
import { HttpClientName } from "./enums.js";
import { ResponseContent } from "./response-content.js";
import { TransportFaults } from "./transport-faults.js";

@Injectable()
export class OutboundHttpClient implements HttpClient {
  private readonly policy: ResiliencePolicy;

  constructor(
    @InjectHttpClient(HttpClientName.Outbound)
    private readonly outbound: NestHttpClient,
    private readonly addresses: AddressPolicy,
    private readonly content: ResponseContent,
    private readonly faults: TransportFaults,
    resilience: ResilienceService,
  ) {
    this.policy = resilience.preset("service-calls");
  }

  admits(uri: string): Promise<boolean> {
    return this.addresses.admits(uri);
  }

  exchange(
    request: OutboundRequest,
    reading: BodyReading,
    signal: AbortSignal,
  ): Promise<HttpReply> {
    return this.#within(signal, async (attempt) => {
      const response = await this.#sent(request, attempt);
      return this.content.replyOf(response, reading);
    });
  }

  text(request: OutboundRequest, signal: AbortSignal): Promise<TextReply> {
    return this.#within(signal, async (attempt) => {
      const response = await this.#sent(request, attempt);
      return this.content.textReplyOf(response);
    });
  }

  async fetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
    const uri = url.toString();
    const headers = new Headers(init.headers);
    const signal = init.signal ?? undefined;
    const redirect = init.redirect ?? "manual";
    const sent = await this.outbound.request(uri, {
      method: init.method,
      headers,
      body: init.body,
      redirect,
      signal,
      responseType: "response",
    });
    return sent.data;
  }

  async #within<T>(
    signal: AbortSignal,
    work: (attempt: AbortSignal) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.policy.execute((attempt) => work(attempt.signal), {
        signal,
      });
    } catch (error) {
      throw this.faults.of(error, signal);
    }
  }

  #sent(request: OutboundRequest, signal: AbortSignal): Promise<Response> {
    return this.fetch(request.uri, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal,
    });
  }
}
