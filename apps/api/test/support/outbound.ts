import { HttpClient as NestHttpClient } from "@nestjs/http-client";
import type { ResilienceService } from "@nestjs/resilience";
import type { AsyncApiInboundMessage, JsonObject } from "interpreter";
import { Agent } from "undici";
import type { AsyncApiInbox } from "../../src/interface-adapters/messaging/interfaces.js";
import { responseSizeLimit } from "../../src/frameworks/di/host.presets.js";
import type { AddressPolicy } from "../../src/frameworks/network/address-policy.js";
import { HOST_PROFILE } from "../../src/frameworks/interpreter/host-profile.js";
import { OutboundHttpConnection } from "../../src/frameworks/network/outbound.http-connection.js";
import { OpenIdAuthorizationServer } from "../../src/frameworks/oauth/openid.authorization-server.js";
import { Authenticator } from "../../src/interface-adapters/workflows/effects/authenticator.js";
import { HttpGateway } from "../../src/interface-adapters/workflows/effects/http.gateway.js";
import type { CallContext } from "../../src/interface-adapters/workflows/effects/interfaces.js";
import { ResourceGateway } from "../../src/interface-adapters/workflows/effects/resource.gateway.js";
import { ResponseContent } from "../../src/interface-adapters/workflows/effects/response-content.js";
import { TransportFailures } from "../../src/interface-adapters/workflows/effects/transport-failures.js";

export const SELF_SIGNED = {
  cert: `-----BEGIN CERTIFICATE-----
MIIBmjCCAUGgAwIBAgIUJxxjzi7vg6A8T27mkk3r4brV9UwwCgYIKoZIzj0EAwIw
FDESMBAGA1UEAwwJMTI3LjAuMC4xMCAXDTI2MTEyMjAxNDYwMVoYDzIxMjYxMDI5
MDE0NjAxWjAUMRIwEAYDVQQDDAkxMjcuMC4wLjEwWTATBgcqhkjOPQIBBggqhkjO
PQMBBwNCAAQd8fC9hYxG9aKnI70VD8FYr2h6cjx6+E2mTlPdbrcVFFVbaPtC1iEn
QJkthcpUKpIjeIyG7VrzO+1NQDS4bY00o28wbTAdBgNVHQ4EFgQU00MwQfkq4jN7
jiurn9279C5cv1cwHwYDVR0jBBgwFoAU00MwQfkq4jN7jiurn9279C5cv1cwDwYD
VR0TAQH/BAUwAwEB/zAaBgNVHREEEzARhwR/AAABgglsb2NhbGhvc3QwCgYIKoZI
zj0EAwIDRwAwRAIgGVQ/R+AvywmmWD9fmf/grz80PwNveSim1h118mv/uaoCIC+X
wiA6Lm2oEHmwNeiAwrxaMrNclKBGsGu91SJMi3I/
-----END CERTIFICATE-----`,
  key: `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgbm7wRR7aUnaK6TWj
Q97nmNWnWkfB2uiAD/VQUec9KyWhRANCAAQd8fC9hYxG9aKnI70VD8FYr2h6cjx6
+E2mTlPdbrcVFFVbaPtC1iEnQJkthcpUKpIjeIyG7VrzO+1NQDS4bY00
-----END PRIVATE KEY-----`,
};

export function fetchClientOf(dispatcher: Agent): NestHttpClient {
  return new NestHttpClient({
    dispatcher,
    retry: false,
    throwOnHttpError: false,
    redirect: "manual",
    interceptors: [responseSizeLimit],
  });
}

export function trustingIdentityProvider(): NestHttpClient {
  const dispatcher = new Agent({ connect: { ca: SELF_SIGNED.cert } });
  return fetchClientOf(dispatcher);
}

export function authenticationOf(identity: NestHttpClient): Authenticator {
  const server = new OpenIdAuthorizationServer(identity);
  return new Authenticator(server, HOST_PROFILE);
}

export function connectionOf(policy: AddressPolicy): OutboundHttpConnection {
  const outbound = fetchClientOf(policy.dispatcher);
  return new OutboundHttpConnection(outbound, policy);
}

export function httpGatewayOf(
  policy: AddressPolicy,
  resilience: ResilienceService,
  identity: NestHttpClient = fetchClientOf(policy.dispatcher),
): HttpGateway {
  return new HttpGateway(
    connectionOf(policy),
    authenticationOf(identity),
    new ResponseContent(),
    new TransportFailures(),
    resilience,
  );
}

export function resourcesOf(
  policy: AddressPolicy,
  resilience: ResilienceService,
  identity: NestHttpClient = fetchClientOf(policy.dispatcher),
): ResourceGateway {
  return new ResourceGateway(
    httpGatewayOf(policy, resilience, identity),
    authenticationOf(identity),
    new ResponseContent(),
    new TransportFailures(),
    resilience,
  );
}

export function callContextOf(
  idempotencyKey: string,
  secrets: JsonObject = {},
  remaining: number | null = null,
): CallContext {
  const signal =
    remaining === null
      ? new AbortController().signal
      : AbortSignal.timeout(remaining);
  return { idempotencyKey, signal, secrets, remaining };
}

export function inboxOf(
  deliver: (message: AsyncApiInboundMessage) => Promise<void>,
  lost: () => void = () => {},
): AsyncApiInbox {
  return {
    ended: new AbortController().signal,
    demanded: () => Promise.resolve(),
    message: deliver,
    failure: (failure) =>
      Promise.reject(new Error(`The receive failed: ${failure.kind}`)),
    lost,
  };
}
