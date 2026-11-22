import request from "supertest";
import { Role } from "../../../src/domain/identity/enums.js";
import shellPlatform from "../../../src/frameworks/go-judge/shell-platform.json" with { type: "json" };
import { authHeaders, createUser, signIn } from "../../support/auth-helpers.js";
import { createTestApp, type TestApp } from "../../support/create-test-app.js";
import { truncateAll } from "../../support/db.js";

interface ShellBody {
  readonly platform: string;
  readonly shell: string;
  readonly commands: readonly string[];
}

describe("the host profile", () => {
  let t: TestApp;
  let viewer: Record<string, string>;

  beforeAll(async () => {
    t = await createTestApp();
    await truncateAll(t.db);
    await createUser(t, { email: "viewer@example.com", role: Role.Viewer });
    viewer = authHeaders(await signIn(t.server, "viewer@example.com"));
  });

  afterAll(async () => {
    await t.close();
  });

  it("documents_the_sandboxs_shell_its_platform_and_the_commands_it_supports", async () => {
    const response = await request(t.server)
      .get("/api/v1/host-profile")
      .set(viewer)
      .expect(200);
    const shell = (response.body as { readonly shell: ShellBody }).shell;

    expect(shell).toEqual(shellPlatform);
    expect(shell.platform).toBe("Debian GNU/Linux 13 (trixie), x86_64");
    expect(shell.shell).toBe("/bin/sh");
    expect(shell.commands).toEqual(
      expect.arrayContaining(["sh", "cat", "grep", "node", "python3"]),
    );
  });

  it("offers_the_asyncapi_effect_over_the_protocols_the_host_publishes_and_receives_on", async () => {
    const response = await request(t.server)
      .get("/api/v1/host-profile")
      .set(viewer)
      .expect(200);
    const profile = response.body as {
      readonly effects: readonly string[];
      readonly asyncApiProtocols: readonly string[];
    };

    expect(profile.effects).toContain("asyncapi");
    expect(profile.asyncApiProtocols).toEqual([
      "amqp",
      "amqps",
      "kafka",
      "kafka-secure",
      "mqtt",
      "mqtt5",
      "secure-mqtt",
      "nats",
      "redis",
    ]);
  });

  it("is_read_only_within_a_session", async () => {
    await request(t.server).get("/api/v1/host-profile").expect(401);
  });
});
