import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  available,
  command,
  forgetSession,
  keepIssuedSession,
  read,
  send,
  UNAVAILABLE,
} from "./http";
import { SIGN_IN_AGAIN_HEADER } from "./session-cookie";

const cookieStore = { get: vi.fn() };
const cookieJar = vi.fn(() => Promise.resolve<unknown>(cookieStore));
const requestHeaders = new Headers();
const redirect = vi.fn((address: string) => {
  const digest = `NEXT_REDIRECT;${address}`;
  throw new Error(digest);
});
const fetchApi = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: () => cookieJar(),
  headers: () => Promise.resolve(requestHeaders),
}));
vi.mock("next/navigation", () => ({
  redirect: (address: string) => redirect(address),
}));

function answer(status: number, body?: unknown, headers?: HeadersInit) {
  const text = body === undefined ? null : JSON.stringify(body);
  return new Response(text, { status, headers });
}

function lastRequest(): { url: URL; init: RequestInit } {
  const [url, init] = fetchApi.mock.lastCall as [URL, RequestInit];
  return { url, init };
}

function lastHeaders(): Headers {
  const { init } = lastRequest();
  return new Headers(init.headers);
}

async function setCookiesOf(keeping: () => Promise<void>): Promise<string[]> {
  const response = NextResponse.next();
  cookieJar.mockResolvedValue(response.cookies);
  await keeping();
  return response.headers.getSetCookie();
}

describe("a request to the API", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
    vi.stubGlobal("fetch", fetchApi);
    fetchApi.mockReset();
    redirect.mockClear();
    cookieStore.get.mockReturnValue({ value: "sid=abc" });
    requestHeaders.set(SIGN_IN_AGAIN_HEADER, "/sign-in?reason=ended&next=%2F");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("goes_by_its_method_to_the_versioned_address_with_the_parameters_given", async () => {
    const created = answer(201, { id: "run-1" });
    fetchApi.mockResolvedValue(created);

    await send("/workflows/sales/route-lead/instances", {
      method: "POST",
      query: { version: "latest", cursor: undefined, empty: "" },
    });

    const { url, init } = lastRequest();
    expect(url.href).toBe(
      "http://api.test/api/v1/workflows/sales/route-lead/instances?version=latest",
    );
    expect(init.method).toBe("POST");
  });

  it("the_persons_address_goes_to_the_api_even_when_anonymous", async () => {
    fetchApi.mockResolvedValue(answer(204));
    requestHeaders.set("x-forwarded-for", "203.0.113.7");

    await send("/auth/session", { method: "POST", anonymous: true });

    expect(lastHeaders().get("x-forwarded-for")).toBe("203.0.113.7");
    requestHeaders.delete("x-forwarded-for");
  });

  it("a_json_body_is_sent_as_json", async () => {
    const created = answer(201, { id: "run-1" });
    fetchApi.mockResolvedValue(created);

    await send("/workflows/sales/route-lead/instances", {
      method: "POST",
      json: { input: {} },
    });

    const { init } = lastRequest();
    expect(init.body).toBe('{"input":{}}');
    const headers = lastHeaders();
    const contentType = headers.get("content-type");
    expect(contentType).toBe("application/json");
  });

  it("forwards_the_session", async () => {
    const found = answer(200, []);
    fetchApi.mockResolvedValue(found);

    await send("/workflows");

    const headers = lastHeaders();
    const cookie = headers.get("cookie");
    expect(cookie).toBe("sid=abc");
  });

  it("accepts_json_or_a_problem", async () => {
    const found = answer(200, []);
    fetchApi.mockResolvedValue(found);

    await send("/workflows");

    const headers = lastHeaders();
    const acceptedTypes = headers.get("accept");
    expect(acceptedTypes).toBe("application/json, application/problem+json");
  });

  it("its_answer_is_not_kept_in_the_data_cache", async () => {
    const found = answer(200, []);
    fetchApi.mockResolvedValue(found);

    await send("/workflows");

    const { init } = lastRequest();
    expect(init.cache).toBe("no-store");
  });

  it("an_anonymous_call_sends_no_session", async () => {
    const unauthorized = answer(401, { title: "Invalid credentials" });
    fetchApi.mockResolvedValue(unauthorized);

    await send("/auth/session", { method: "POST", anonymous: true });

    const headers = lastHeaders();
    const hasCookie = headers.has("cookie");
    expect(hasCookie).toBe(false);
  });

  it("the_401_of_an_anonymous_call_is_an_answer", async () => {
    const unauthorized = answer(401, { title: "Invalid credentials" });
    fetchApi.mockResolvedValue(unauthorized);

    const response = await send("/auth/session", {
      method: "POST",
      anonymous: true,
    });

    expect(response.status).toBe(401);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("a_401_on_a_signed_in_call_signs_in_again_where_the_app_said", async () => {
    const ended = answer(401);
    fetchApi.mockResolvedValue(ended);

    const sending = send("/workflows");

    await expect(sending).rejects.toThrow(
      "NEXT_REDIRECT;/sign-in?reason=ended&next=%2F",
    );
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it("a_401_without_an_address_to_sign_in_again_fails_as_unauthorized", async () => {
    requestHeaders.delete(SIGN_IN_AGAIN_HEADER);
    const ended = answer(401);
    fetchApi.mockResolvedValue(ended);

    const sending = send("/workflows");

    await expect(sending).rejects.toMatchObject({ status: 401 });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("a_platform_that_does_not_answer_fails_with_what_to_do", async () => {
    const networkError = new TypeError("fetch failed: ECONNREFUSED");
    fetchApi.mockRejectedValue(networkError);

    const sending = send("/workflows");

    await expect(sending).rejects.toEqual(
      new ApiError(503, "The platform is not answering; try again in a moment"),
    );
  });

  it("a_platform_that_does_not_answer_keeps_its_cause_for_the_server_log", async () => {
    const networkError = new TypeError("fetch failed");
    fetchApi.mockRejectedValue(networkError);

    const sending = send("/workflows");

    await expect(sending).rejects.toMatchObject({
      status: 503,
      cause: networkError,
    });
  });

  it("a_text_body_carries_its_own_type", async () => {
    const noContent = answer(204);
    fetchApi.mockResolvedValue(noContent);

    await send("/webhooks/hook-1", {
      method: "POST",
      text: "a,b",
      contentType: "text/csv",
    });

    const { init } = lastRequest();
    expect(init.body).toBe("a,b");
    const headers = lastHeaders();
    const contentType = headers.get("content-type");
    expect(contentType).toBe("text/csv");
  });
});

describe("a read", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetchApi);
    fetchApi.mockReset();
    cookieStore.get.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is_the_value_the_api_answered", async () => {
    const found = answer(200, { name: "route-lead" });
    fetchApi.mockResolvedValue(found);

    const value = await read("/workflows/sales/route-lead");

    expect(value).toEqual({ name: "route-lead" });
  });

  it("a_resource_that_does_not_exist_is_null", async () => {
    const missing = answer(404, { title: "Not found" });
    fetchApi.mockResolvedValue(missing);

    const value = await read("/workflows/sales/gone");

    expect(value).toBeNull();
  });

  it("another_refusal_fails_with_its_detail", async () => {
    const forbidden = answer(403, {
      title: "Forbidden",
      detail: "Only authors may read it",
    });
    fetchApi.mockResolvedValue(forbidden);

    const reading = read("/secrets");

    await expect(reading).rejects.toEqual(
      new ApiError(403, "Only authors may read it"),
    );
  });

  it("an_answer_that_never_changes_is_kept_in_the_data_cache", async () => {
    const found = answer(200, {});
    fetchApi.mockResolvedValue(found);

    await read("/workflows/sales/route-lead/versions/1.0.0", {
      immutable: true,
    });

    const { init } = lastRequest();
    expect(init.cache).toBe("force-cache");
  });

  it("without_a_session_none_is_sent", async () => {
    const found = answer(200, []);
    fetchApi.mockResolvedValue(found);

    await read("/workflows");

    const headers = lastHeaders();
    const hasCookie = headers.has("cookie");
    expect(hasCookie).toBe(false);
  });
});

describe("a command", () => {
  beforeEach(() => {
    vi.stubEnv("API_URL", "http://api.test");
    vi.stubGlobal("fetch", fetchApi);
    fetchApi.mockReset();
    cookieStore.get.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is_its_value", async () => {
    const created = answer(201, { id: "hook-1" });
    fetchApi.mockResolvedValue(created);

    const outcome = await command("/webhooks", { method: "POST", json: {} });

    expect(outcome).toEqual({ ok: true, value: { id: "hook-1" } });
  });

  it("an_empty_answer_has_no_value", async () => {
    const noContent = answer(204);
    fetchApi.mockResolvedValue(noContent);

    const outcome = await command("/secrets/token", { method: "DELETE" });

    expect(outcome).toEqual({ ok: true, value: undefined });
  });

  it("a_refusal_is_the_problem_the_api_stated", async () => {
    const conflict = answer(409, {
      type: "urn:problem:workflow.archived",
      title: "The workflow is archived",
      status: 409,
      detail: "route-lead is archived",
    });
    fetchApi.mockResolvedValue(conflict);

    const outcome = await command("/workflows/sales/route-lead/turn-on", {
      method: "POST",
    });

    expect(outcome).toMatchObject({
      ok: false,
      problem: { status: 409, detail: "route-lead is archived" },
    });
  });

  it("a_body_that_is_not_json_is_still_a_problem", async () => {
    const badGateway = new Response("Bad gateway", { status: 502 });
    fetchApi.mockResolvedValue(badGateway);

    const outcome = await command("/webhooks", { method: "POST" });

    expect(outcome).toMatchObject({
      ok: false,
      problem: { status: 502, title: "HTTP 502" },
    });
  });

  it("a_platform_that_does_not_answer_is_a_problem_the_form_can_show", async () => {
    const networkError = new TypeError("fetch failed");
    fetchApi.mockRejectedValue(networkError);

    const outcome = await command("/webhooks", { method: "POST" });

    expect(outcome).toMatchObject({
      ok: false,
      problem: { status: 503, title: "The platform is not answering" },
    });
  });

  it("without_the_address_of_the_api_nothing_is_sent", async () => {
    vi.stubEnv("API_URL", "");

    const sending = command("/webhooks", { method: "POST" });

    await expect(sending).rejects.toThrow("API_URL is not set");
    expect(fetchApi).not.toHaveBeenCalled();
  });
});

describe("the session the console keeps", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      now: new Date("2026-11-21T12:00:00Z"),
      toFake: ["Date"],
    });
    vi.stubEnv("SESSION_COOKIE_SECURE", "false");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    cookieJar.mockReset();
  });

  it("is_the_one_the_api_issued_for_its_lifetime", async () => {
    const issued = answer(
      200,
      {},
      { "set-cookie": "sid=new; Max-Age=3600; Path=/; HttpOnly" },
    );

    const setCookies = await setCookiesOf(() => keepIssuedSession(issued));

    expect(setCookies).toEqual([
      "console_session=sid%3Dnew; Path=/; Expires=Sat, 21 Nov 2026 13:00:00 GMT; Max-Age=3600; HttpOnly; SameSite=lax",
    ]);
  });

  it("a_session_the_api_ended_is_expired", async () => {
    const ended = answer(200, {}, { "set-cookie": "sid=; Max-Age=0" });

    const setCookies = await setCookiesOf(() => keepIssuedSession(ended));

    expect(setCookies).toEqual([
      "console_session=; Path=/; Max-Age=0; HttpOnly; SameSite=lax",
    ]);
  });

  it("an_answer_without_a_session_changes_nothing", async () => {
    const plain = answer(200, {});

    const setCookies = await setCookiesOf(() => keepIssuedSession(plain));

    expect(setCookies).toEqual([]);
  });

  it("under_https_the_issued_session_is_a_host_cookie_sent_only_over_https", async () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    const issued = answer(
      200,
      {},
      { "set-cookie": "sid=new; Max-Age=3600; Path=/; HttpOnly" },
    );

    const setCookies = await setCookiesOf(() => keepIssuedSession(issued));

    expect(setCookies).toEqual([
      "__Host-console_session=sid%3Dnew; Path=/; Expires=Sat, 21 Nov 2026 13:00:00 GMT; Max-Age=3600; Secure; HttpOnly; SameSite=lax",
    ]);
  });

  it("under_https_a_session_the_api_ended_is_expired_with_secure_at_the_root", async () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");
    const ended = answer(200, {}, { "set-cookie": "sid=; Max-Age=0" });

    const setCookies = await setCookiesOf(() => keepIssuedSession(ended));

    expect(setCookies).toEqual([
      "__Host-console_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax",
    ]);
  });

  it("under_https_signing_out_expires_the_host_cookie_with_secure_at_the_root", async () => {
    vi.stubEnv("SESSION_COOKIE_SECURE", "true");

    const setCookies = await setCookiesOf(forgetSession);

    expect(setCookies).toEqual([
      "__Host-console_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax",
    ]);
  });
});

describe("a read the page can do without", () => {
  it("a_platform_that_is_down_is_an_answer_and_a_refusal_still_fails", async () => {
    const down = Promise.reject(new ApiError(503, "Not answering"));
    const refused = Promise.reject(new ApiError(403, "Not yours"));

    const read = await available(down);

    expect(read).toBe(UNAVAILABLE);
    await expect(available(refused)).rejects.toThrow("Not yours");
  });
});
