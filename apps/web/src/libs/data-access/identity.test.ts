import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./http";
import {
  acceptInvitation,
  changePassword,
  currentSession,
  members,
  signIn,
  signOut,
} from "./identity";

const { sessionPair, read, send, command, keepIssuedSession, forgetSession } =
  vi.hoisted(() => ({
    sessionPair: vi.fn(),
    read: vi.fn(),
    send: vi.fn(),
    command: vi.fn(),
    keepIssuedSession: vi.fn(),
    forgetSession: vi.fn(),
  }));

vi.mock("server-only", () => ({}));
vi.mock("./http", async () => {
  const actual = await vi.importActual<typeof import("./http")>("./http");
  return {
    ApiError: actual.ApiError,
    bodyOfResponse: actual.bodyOfResponse,
    problemOfResponse: actual.problemOfResponse,
    sessionPair,
    read,
    send,
    command,
    keepIssuedSession,
    forgetSession,
  };
});
vi.mock("next/headers", () => ({}));
vi.mock("next/navigation", () => ({}));

const ADA = { id: "u-1", email: "ada@example.com", name: "Ada", role: "admin" };

describe("the identity routes", () => {
  beforeEach(() => {
    [
      sessionPair,
      read,
      send,
      command,
      keepIssuedSession,
      forgetSession,
    ].forEach((mock) => mock.mockReset());
  });

  it("without_a_session_there_is_no_user_and_the_api_is_not_asked", async () => {
    sessionPair.mockResolvedValue(null);

    const session = await currentSession();

    expect(session).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it("with_a_session_the_api_says_whose_it_is_and_what_they_may_do", async () => {
    const capabilities = { author: true, operator: true, administrator: false };
    sessionPair.mockResolvedValue("sid=abc");
    read.mockResolvedValue({ user: ADA, capabilities });

    const session = await currentSession();

    expect(read).toHaveBeenCalledWith("/auth/session");
    expect(session).toEqual({ user: ADA, capabilities });
  });

  it("signing_in_keeps_the_session_the_api_issued", async () => {
    const response = new Response(JSON.stringify({ user: ADA }), {
      status: 201,
    });
    send.mockResolvedValue(response);

    const outcome = await signIn("ada@example.com", "correct horse");

    expect(send).toHaveBeenCalledWith("/auth/session", {
      method: "POST",
      json: { email: "ada@example.com", password: "correct horse" },
      anonymous: true,
    });
    expect(keepIssuedSession).toHaveBeenCalledWith(response);
    expect(outcome).toEqual({ ok: true, value: ADA });
  });

  it("a_refused_sign_in_keeps_nothing_and_says_why", async () => {
    const refusal = {
      title: "Unauthorized",
      detail: "Wrong email or password",
    };
    send.mockResolvedValue(
      new Response(JSON.stringify(refusal), { status: 401 }),
    );

    const outcome = await signIn("ada@example.com", "wrong");

    expect(keepIssuedSession).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      ok: false,
      problem: { status: 401, detail: "Wrong email or password" },
    });
  });

  it("a_platform_that_does_not_answer_is_a_problem_the_form_can_show", async () => {
    send.mockRejectedValue(new ApiError(503, "The platform is not answering"));

    const outcome = await signIn("ada@example.com", "correct horse");

    expect(outcome).toMatchObject({ ok: false, problem: { status: 503 } });
  });

  it("a_changed_password_keeps_the_rotated_session_and_has_no_value", async () => {
    send.mockResolvedValue(
      new Response(JSON.stringify({ user: ADA }), { status: 200 }),
    );

    const outcome = await changePassword("old password 1", "new password 2");

    expect(send).toHaveBeenCalledWith("/auth/password", {
      method: "PATCH",
      json: {
        currentPassword: "old password 1",
        newPassword: "new password 2",
      },
      anonymous: false,
    });
    expect(keepIssuedSession).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ ok: true, value: undefined });
  });

  it("signing_out_ends_the_session_at_the_api_and_forgets_it", async () => {
    command.mockResolvedValue({ ok: true, value: undefined });

    await signOut();

    expect(command).toHaveBeenCalledWith("/auth/session", { method: "DELETE" });
    expect(forgetSession).toHaveBeenCalledTimes(1);
  });

  it("an_accepted_invitation_keeps_the_session_the_api_issued", async () => {
    const response = new Response(JSON.stringify({ user: ADA }), {
      status: 200,
    });
    send.mockResolvedValue(response);

    const outcome = await acceptInvitation("t-1", "Ada", "correct horse");

    expect(send).toHaveBeenCalledWith("/invitations/accept", {
      method: "POST",
      json: { token: "t-1", name: "Ada", password: "correct horse" },
      anonymous: true,
    });
    expect(keepIssuedSession).toHaveBeenCalledWith(response);
    expect(outcome).toEqual({ ok: true, value: ADA });
  });

  it("a_refused_invitation_keeps_nothing_and_says_why", async () => {
    const refusal = { title: "Gone", detail: "This invitation has expired" };
    send.mockResolvedValue(
      new Response(JSON.stringify(refusal), { status: 410 }),
    );

    const outcome = await acceptInvitation("t-1", "Ada", "correct horse");

    expect(keepIssuedSession).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      ok: false,
      problem: { status: 410, detail: "This invitation has expired" },
    });
  });

  it("lists_the_workspaces_members_and_none_when_the_api_has_none", async () => {
    const member = {
      id: "u-1",
      email: "ada@example.com",
      name: "Ada",
      role: "admin",
      status: "active",
      since: "2026-11-01T09:00:00Z",
    };
    read.mockResolvedValueOnce([member]).mockResolvedValueOnce(null);

    const listed = await members();
    const none = await members();

    expect(read).toHaveBeenCalledWith("/members");
    expect(listed).toEqual([member]);
    expect(none).toEqual([]);
  });
});
