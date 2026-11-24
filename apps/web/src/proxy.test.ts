// @vitest-environment node
import { getRedirectUrl } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./proxy";

vi.mock("server-only", () => ({}));

const ORIGIN = "https://console.test";
const SIGN_IN = "https://console.test/sign-in";

describe("the proxy in front of every page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("a_visitor_without_a_session_is_sent_to_sign_in_and_back", () => {
    const request = new NextRequest(
      "https://console.test/workflows?status=archived",
    );

    const response = proxy(request);

    const address = getRedirectUrl(response);
    expect(address).toBe(
      "https://console.test/sign-in?next=%2Fworkflows%3Fstatus%3Darchived",
    );
  });

  it.each([
    ["/sign-in"],
    ["/forgot-password"],
    ["/reset-password"],
    ["/invitations/accept"],
  ])("the_signed_out_pages_open_without_a_session: %s", (path) => {
    const page = `${ORIGIN}${path}`;
    const request = new NextRequest(page);

    const response = proxy(request);

    const address = getRedirectUrl(response);
    expect(address).toBeNull();
  });

  it.each([["console_session"], ["__Host-console_session"]])(
    "a_session_cookie_of_either_name_opens_the_console: %s",
    (name) => {
      const cookie = `${name}=sid%3Dabc`;
      const request = new NextRequest("https://console.test/workflows", {
        headers: { cookie },
      });

      const response = proxy(request);

      const address = getRedirectUrl(response);
      expect(address).toBeNull();
    },
  );

  it("every_page_gets_a_policy_of_its_own", () => {
    const first = new NextRequest(SIGN_IN);
    const second = new NextRequest(SIGN_IN);

    const firstResponse = proxy(first);
    const secondResponse = proxy(second);

    const firstPolicy = firstResponse.headers.get("content-security-policy");
    expect(firstPolicy).toContain("'nonce-");
    const secondPolicy = secondResponse.headers.get("content-security-policy");
    expect(secondPolicy).toContain("'nonce-");
    expect(firstPolicy).not.toBe(secondPolicy);
  });

  it("in_production_scripts_run_only_with_the_nonce", () => {
    vi.stubEnv("NODE_ENV", "production");
    const request = new NextRequest(SIGN_IN);

    const response = proxy(request);

    const policy = response.headers.get("content-security-policy");
    expect(policy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic';/);
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("in_development_the_dev_server_may_evaluate_code", () => {
    vi.stubEnv("NODE_ENV", "development");
    const request = new NextRequest(SIGN_IN);

    const response = proxy(request);

    const policy = response.headers.get("content-security-policy");
    expect(policy).toContain("'unsafe-eval'");
  });

  it.each([
    ["false", false],
    ["true", true],
  ])(
    "requests_are_upgraded_unless_SESSION_COOKIE_SECURE_is_false: SESSION_COOKIE_SECURE=%s upgrades %s",
    (secure, upgrades) => {
      vi.stubEnv("SESSION_COOKIE_SECURE", secure);
      const request = new NextRequest(SIGN_IN);

      const response = proxy(request);

      const policy = response.headers.get("content-security-policy");
      const upgraded = policy?.includes("upgrade-insecure-requests");
      expect(upgraded).toBe(upgrades);
    },
  );
});
