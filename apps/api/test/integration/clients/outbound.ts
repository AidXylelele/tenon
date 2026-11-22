import { HttpClient as NestHttpClient } from "@nestjs/http-client";
import type { ResilienceService } from "@nestjs/resilience";
import type { AsyncApiInboundMessage, JsonObject } from "interpreter";
import { Agent } from "undici";
import type { AsyncApiInbox } from "../../../src/frameworks/asyncapi/interfaces.js";
import type { AddressPolicy } from "../../../src/frameworks/http-client/address-policy.js";
import { AuthorizationServer } from "../../../src/frameworks/http-client/authorization-server.js";
import { DigestAuthentication } from "../../../src/frameworks/http-client/digest-authentication.js";
import { HttpAuthentication } from "../../../src/frameworks/http-client/http-authentication.js";
import { HttpClient } from "../../../src/frameworks/http-client/http.client.js";
import { OpenApiOperations } from "../../../src/frameworks/http-client/openapi-operations.js";
import { ResponseSizeLimit } from "../../../src/frameworks/http-client/response-size-limit.js";
import type { CallContext } from "../../../src/frameworks/workflows/interfaces.js";

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
    interceptors: [new ResponseSizeLimit(HttpClient.RESPONSE_BYTES)],
  });
}

export function trustingIdentityProvider(): NestHttpClient {
  const dispatcher = new Agent({ connect: { ca: SELF_SIGNED.cert } });
  return fetchClientOf(dispatcher);
}

export function authenticationOf(identity: NestHttpClient): HttpAuthentication {
  return new HttpAuthentication(new AuthorizationServer(identity));
}

export function httpClientOf(
  policy: AddressPolicy,
  resilience: ResilienceService,
  identity: NestHttpClient = fetchClientOf(policy.dispatcher),
): HttpClient {
  return new HttpClient(
    fetchClientOf(policy.dispatcher),
    authenticationOf(identity),
    new DigestAuthentication(),
    new OpenApiOperations(),
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
