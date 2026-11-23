import { Injectable } from "@nestjs/common";
import {
  InjectHttpClient,
  HttpClient as NestHttpClient,
} from "@nestjs/http-client";
import type { HttpConnection } from "../../interface-adapters/workflows/effects/interfaces.js";
import { AddressPolicy } from "./address-policy.js";
import { HttpClientName } from "./enums.js";

@Injectable()
export class OutboundHttpConnection implements HttpConnection {
  constructor(
    @InjectHttpClient(HttpClientName.Outbound)
    private readonly outbound: NestHttpClient,
    private readonly addresses: AddressPolicy,
  ) {}

  admits(uri: string): Promise<boolean> {
    const hostname = new URL(uri).hostname;
    return this.addresses.admits(hostname);
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
}
