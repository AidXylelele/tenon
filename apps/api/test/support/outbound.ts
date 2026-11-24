import { HttpClient as NestHttpClient } from "@nestjs/http-client";
import type { ResilienceService } from "@nestjs/resilience";
import type { AsyncApiInboundMessage, JsonObject } from "interpreter";
import { Agent } from "undici";
import type { AsyncApiInbox } from "../../src/interface-adapters/asyncapi/interfaces.js";
import { responseSizeLimit } from "../../src/frameworks/di/host.presets.js";
import type { AddressPolicy } from "../../src/frameworks/http/address-policy.js";
import { UndiciHttpClient } from "../../src/frameworks/http/undici.http-client.js";
import { ResponseContent } from "../../src/frameworks/http/response-content.js";
import { TransportFaults } from "../../src/frameworks/http/transport-faults.js";
import { HOST_PROFILE } from "../../src/frameworks/interpreter/host-profile.js";
import { OpenIdAccessTokens } from "../../src/frameworks/oauth/openid.access-tokens.js";
import { OpenIdAuthorizationServer } from "../../src/frameworks/oauth/openid.authorization-server.js";
import { Authenticator } from "../../src/interface-adapters/auth/authenticator.js";
import { HttpGateway } from "../../src/interface-adapters/http/http.gateway.js";
import { ResourceGateway } from "../../src/interface-adapters/http/resource.gateway.js";
import type { CallContext } from "../../src/interface-adapters/workflows/effects/interfaces.js";

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

export function clientOf(
  policy: AddressPolicy,
  resilience: ResilienceService,
  outbound: NestHttpClient = fetchClientOf(policy.dispatcher),
): UndiciHttpClient {
  return new UndiciHttpClient(
    outbound,
    policy,
    new ResponseContent(),
    new TransportFaults(),
    resilience,
  );
}

export function authenticationOf(
  policy: AddressPolicy,
  resilience: ResilienceService,
  identity: NestHttpClient = fetchClientOf(policy.dispatcher),
): Authenticator {
  const http = clientOf(policy, resilience, identity);
  const server = new OpenIdAuthorizationServer(http);
  const tokens = new OpenIdAccessTokens(
    server,
    new TransportFaults(),
    resilience,
  );
  return new Authenticator(tokens, HOST_PROFILE);
}

export function httpGatewayOf(
  policy: AddressPolicy,
  resilience: ResilienceService,
  identity: NestHttpClient = fetchClientOf(policy.dispatcher),
): HttpGateway {
  return new HttpGateway(
    clientOf(policy, resilience),
    authenticationOf(policy, resilience, identity),
  );
}

export function resourcesOf(
  policy: AddressPolicy,
  resilience: ResilienceService,
  identity: NestHttpClient = fetchClientOf(policy.dispatcher),
): ResourceGateway {
  return new ResourceGateway(
    clientOf(policy, resilience),
    authenticationOf(policy, resilience, identity),
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
