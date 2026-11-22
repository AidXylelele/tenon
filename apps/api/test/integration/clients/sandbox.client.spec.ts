import type { INestApplicationContext } from "@nestjs/common";
import { HttpClient as NestHttpClient } from "@nestjs/http-client";
import { CircuitOpenError, ResilienceService } from "@nestjs/resilience";
import { Test } from "@nestjs/testing";
import type { Script, Shell } from "interpreter";
import { ConfigModule } from "@nestjs/config";
import { envSchema } from "../../../src/frameworks/di/env.schema.js";
import { ResilienceModule } from "@nestjs/resilience";
import { resiliencePresets } from "../../../src/frameworks/di/resilience.presets.js";
import type { SandboxedProcessRequest } from "../../../src/frameworks/go-judge/interfaces.js";
import { SandboxClient } from "../../../src/frameworks/go-judge/sandbox.client.js";
import { SandboxLimits } from "../../../src/frameworks/go-judge/sandbox-limits.js";
import { AddressPolicy } from "../../../src/frameworks/http-client/address-policy.js";
import type { HttpClient } from "../../../src/frameworks/http-client/http.client.js";
import { ResponseSizeLimit } from "../../../src/frameworks/http-client/response-size-limit.js";
import type { CallContext } from "../../../src/frameworks/workflows/interfaces.js";
import {
  closedPort,
  startStubServer,
  type StubServer,
} from "../../support/stub-server.js";
import { callContextOf, httpClientOf } from "./outbound.js";

const SANDBOX_TOKEN = "sandbox-token";
const LIMITS = new SandboxLimits({
  time: Temporal.Duration.from({ seconds: 30 }),
  memoryBytes: 256 * 1024 * 1024,
  processes: 50,
  outputBytes: 1024,
});
const PATH = "PATH=/usr/local/bin:/usr/bin:/bin";
const THIRTY_SECONDS_IN_NANOSECONDS = 30_000_000_000;

interface Answer {
  readonly status: number;
  readonly body: string;
}

describe("a process the sandbox runs for a run", () => {
  let context: INestApplicationContext;
  let resilience: ResilienceService;
  let policy: AddressPolicy;
  let http: HttpClient;
  let sandbox: StubServer;
  let sources: StubServer;
  let client: SandboxClient;
  let answer: Answer | null = null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          validationSchema: envSchema,
        }),
        ResilienceModule.forRoot({ presets: resiliencePresets }),
      ],
    }).compile();
    context = await moduleRef.init();
    resilience = context.get(ResilienceService);
    policy = new AddressPolicy(["127.0.0.1"]);
    http = httpClientOf(policy, resilience);
    sandbox = await startStubServer((request, response) => {
      const authorized =
        request.headers.authorization === `Bearer ${SANDBOX_TOKEN}`;

      if (!authorized || request.url !== "/run") {
        response.writeHead(401).end();
        return;
      }

      if (answer === null) return;

      response.writeHead(answer.status, { "content-type": "application/json" });
      response.end(answer.body);
    });
    sources = await startStubServer((request, response) => {
      if (request.url !== "/greet.js") {
        response.writeHead(404).end();
        return;
      }

      response.writeHead(200, { "content-type": "text/javascript" });
      response.end("console.log(greeting);");
    });
    client = sandboxClientOf(sandbox.origin);
  });

  afterAll(async () => {
    await sandbox.close();
    await sources.close();
    await policy.onApplicationShutdown();
    await context.close();
  });

  function sandboxClientOf(baseUrl: string): SandboxClient {
    const runs = new NestHttpClient({
      baseUrl,
      headers: { authorization: `Bearer ${SANDBOX_TOKEN}` },
      retry: false,
      throwOnHttpError: false,
      redirect: "manual",
      interceptors: [new ResponseSizeLimit(LIMITS.responseBytes())],
    });
    return new SandboxClient(runs, http, LIMITS, resilience);
  }

  beforeEach(() => {
    sandbox.received.length = 0;
    answer = null;
  });

  function contextOf(remaining: number | null = null): CallContext {
    return callContextOf("run-1/do/0/greet", {}, remaining);
  }

  function shellOf(properties: Partial<Shell> = {}): SandboxedProcessRequest {
    return {
      kind: "process",
      process: {
        kind: "shell",
        command: 'echo "$1"',
        stdin: null,
        arguments: ["Foo"],
        directory: null,
        environment: {},
        ...properties,
      },
      await: true,
    };
  }

  function scriptOf(properties: Partial<Script> = {}): SandboxedProcessRequest {
    return {
      kind: "process",
      process: {
        kind: "script",
        language: "js",
        code: "console.log(message);",
        source: null,
        stdin: null,
        arguments: {},
        environment: {},
        ...properties,
      },
      await: true,
    };
  }

  function resultOf(result: Record<string, unknown>): Answer {
    return { status: 200, body: JSON.stringify([result]) };
  }

  function commandSent(): Record<string, unknown> {
    const [received] = sandbox.received;
    const sent = JSON.parse(received?.body ?? "{}") as {
      cmd?: Record<string, unknown>[];
    };
    return sent.cmd?.[0] ?? {};
  }

  describe("outcomes", () => {
    it("a_process_that_exits_answers_its_code_and_outputs", async () => {
      answer = resultOf({
        status: "Accepted",
        exitStatus: 0,
        files: { stdout: "Foo\n", stderr: "" },
      });

      const outcome = await client.run(shellOf(), contextOf());

      expect(outcome).toEqual({
        kind: "exited",
        code: 0,
        stdout: "Foo\n",
        stderr: "",
      });
    });

    it("a_process_that_exits_with_another_code_answers_it", async () => {
      answer = resultOf({
        status: "Nonzero Exit Status",
        exitStatus: 3,
        files: { stdout: "", stderr: "boom\n" },
      });

      const outcome = await client.run(shellOf(), contextOf());

      expect(outcome).toEqual({
        kind: "exited",
        code: 3,
        stdout: "",
        stderr: "boom\n",
      });
    });

    it("a_process_the_sandbox_stopped_at_its_time_limit_expires", async () => {
      answer = resultOf({ status: "Time Limit Exceeded", exitStatus: 0 });

      const outcome = await client.run(shellOf(), contextOf());

      expect(outcome).toEqual({ kind: "expired" });
    });

    it("a_process_killed_by_a_signal_exits_with_the_shell_s_code_of_it", async () => {
      answer = resultOf({
        status: "Signalled",
        exitStatus: 15,
        files: { stdout: "", stderr: "" },
      });

      const outcome = await client.run(shellOf(), contextOf());

      expect(outcome).toEqual({
        kind: "exited",
        code: 143,
        stdout: "",
        stderr: "",
      });
    });

    it.each(["Memory Limit Exceeded", "Output Limit Exceeded"])(
      "a_process_stopped_for_%s_is_killed",
      async (status) => {
        answer = resultOf({ status, exitStatus: 0, files: { stdout: "x" } });

        const outcome = await client.run(shellOf(), contextOf());

        expect(outcome).toEqual({
          kind: "killed",
          detail: `The sandbox stopped the process: ${status}`,
        });
      },
    );

    it("a_directory_that_cannot_be_entered_leaves_the_process_unstarted", async () => {
      answer = resultOf({
        status: "Nonzero Exit Status",
        exitStatus: 2,
        files: {
          stdout: "",
          stderr: "",
          directory: "sh: 1: cd: can't cd to /missing\n",
        },
      });

      const outcome = await client.run(
        shellOf({ directory: "/missing" }),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "unstarted",
        detail:
          "The working directory could not be entered: sh: 1: cd: can't cd to /missing",
      });
    });

    it("a_process_that_entered_its_directory_answers_its_exit", async () => {
      answer = resultOf({
        status: "Nonzero Exit Status",
        exitStatus: 1,
        files: { stdout: "", stderr: "boom\n", directory: "" },
      });

      const outcome = await client.run(
        shellOf({ directory: "/tmp" }),
        contextOf(),
      );

      expect(outcome).toEqual({
        kind: "exited",
        code: 1,
        stdout: "",
        stderr: "boom\n",
      });
    });

    it.each(["File Error", "Internal Error"])(
      "a_process_the_sandbox_answers_%s_is_unstarted",
      async (status) => {
        answer = resultOf({ status, error: "no such file" });

        const outcome = await client.run(shellOf(), contextOf());

        expect(outcome).toEqual({
          kind: "unstarted",
          detail: `The sandbox could not run the process: ${status}`,
        });
      },
    );

    it("a_process_the_sandbox_refuses_is_unstarted_with_its_reason", async () => {
      answer = { status: 400, body: JSON.stringify("invalid request") };

      const outcome = await client.run(shellOf(), contextOf());

      expect(outcome).toEqual({
        kind: "unstarted",
        detail: "The sandbox refused the process: invalid request",
      });
    });

    it("an_answer_that_is_not_the_sandbox_s_rejects_as_a_sandbox_outage", async () => {
      answer = { status: 502, body: "<html>Bad Gateway</html>" };

      const pending = client.run(shellOf(), contextOf());

      await expect(pending).rejects.toThrow(
        new Error("The sandbox answered other than with a result, status 502"),
      );
    });

    it("a_process_still_running_at_its_deadline_expires", async () => {
      const outcome = await client.run(shellOf(), contextOf(200));

      expect(outcome).toEqual({ kind: "expired" });
    });

    it("a_sandbox_nobody_listens_on_rejects_with_the_connection_failure", async () => {
      const port = await closedPort();
      const unreachable = sandboxClientOf(`http://127.0.0.1:${String(port)}`);

      const pending = unreachable.run(shellOf(), contextOf());

      await expect(pending).rejects.toMatchObject({
        cause: { code: "ECONNREFUSED" },
      });
    });

    it("a_sandbox_that_keeps_failing_opens_its_circuit_and_the_next_process_fails_fast", async () => {
      const breaker = resilience.circuitBreaker("processes");
      breaker.reset();
      answer = { status: 500, body: "" };

      try {
        for (let call = 0; call < 10; call++)
          await expect(client.run(shellOf(), contextOf())).rejects.toThrow(
            "status 500",
          );
        const reached = sandbox.received.length;

        const pending = client.run(shellOf(), contextOf());

        await expect(pending).rejects.toBeInstanceOf(CircuitOpenError);
        expect(breaker.state).toBe("open");
        expect(sandbox.received).toHaveLength(reached);
      } finally {
        breaker.reset();
      }
    });
  });

  describe("the command", () => {
    beforeEach(() => {
      answer = resultOf({ status: "Accepted", exitStatus: 0, files: {} });
    });

    it("a_shell_command_runs_in_sh_with_its_arguments_environment_and_stdin", async () => {
      const request = shellOf({
        stdin: "Hello",
        environment: { GREETING: "hi" },
      });

      await client.run(request, contextOf());

      expect(commandSent()).toEqual({
        args: ["/bin/sh", "-c", 'echo "$1"', "sh", "Foo"],
        env: [PATH, "GREETING=hi"],
        files: [
          { content: "Hello" },
          { name: "stdout", max: 1024 },
          { name: "stderr", max: 1024 },
        ],
        cpuLimit: THIRTY_SECONDS_IN_NANOSECONDS,
        clockLimit: THIRTY_SECONDS_IN_NANOSECONDS,
        memoryLimit: 256 * 1024 * 1024,
        procLimit: 50,
        copyIn: {},
      });
    });

    it("a_shell_command_runs_in_its_directory", async () => {
      const request = shellOf({ directory: "/tmp/it's" });

      await client.run(request, contextOf());

      expect(commandSent()).toMatchObject({
        args: [
          "/bin/sh",
          "-c",
          "cd -- '/tmp/it'\\''s' 2>&3 || exit\nexec 3>&-\necho \"$1\"",
          "sh",
          "Foo",
        ],
        files: [
          { content: "" },
          { name: "stdout", max: 1024 },
          { name: "stderr", max: 1024 },
          { name: "directory", max: 1024 },
        ],
      });
    });

    it("a_javascript_script_declares_its_arguments_as_constants", async () => {
      const request = scriptOf({
        arguments: { message: "Hello World", count: 2 },
      });

      await client.run(request, contextOf());

      expect(commandSent()).toMatchObject({
        args: ["/usr/local/bin/node", "script"],
        copyIn: {
          script: {
            content:
              'const message = "Hello World";\nconst count = 2;\nconsole.log(message);',
          },
        },
      });
    });

    it("a_python_script_declares_its_arguments_as_variables", async () => {
      const request = scriptOf({
        language: "python",
        code: "print(message)",
        arguments: { message: { text: 'Hi "you"' } },
      });

      await client.run(request, contextOf());

      expect(commandSent()).toMatchObject({
        args: ["/usr/bin/python3", "script"],
        copyIn: {
          script: {
            content:
              'message = __import__(\'json\').loads("{\\"text\\":\\"Hi \\\\\\"you\\\\\\"\\"}")\nprint(message)',
          },
        },
      });
    });

    it("a_script_argument_that_is_not_a_variable_name_is_misconfigured", async () => {
      const request = scriptOf({ arguments: { "not-a-name": 1 } });

      const outcome = await client.run(request, contextOf());

      expect(outcome).toEqual({
        kind: "misconfigured",
        detail:
          "An argument of the script is not a variable name of its language",
      });
      expect(sandbox.received).toHaveLength(0);
    });

    it.each([
      ["js", "class"],
      ["js", "let"],
      ["js", "await"],
      ["python", "lambda"],
      ["python", "None"],
    ] as const)(
      "a_%s_script_argument_named_by_the_reserved_word_%s_is_misconfigured",
      async (language, name) => {
        const request = scriptOf({ language, arguments: { [name]: 1 } });

        const outcome = await client.run(request, contextOf());

        expect(outcome).toEqual({
          kind: "misconfigured",
          detail:
            "An argument of the script is not a variable name of its language",
        });
        expect(sandbox.received).toHaveLength(0);
      },
    );

    it("a_python_script_argument_named_by_a_soft_keyword_is_declared", async () => {
      const request = scriptOf({
        language: "python",
        code: "print(match)",
        arguments: { match: 1 },
      });

      await client.run(request, contextOf());

      expect(commandSent()).toMatchObject({
        copyIn: {
          script: {
            content: "match = __import__('json').loads(\"1\")\nprint(match)",
          },
        },
      });
    });

    it("a_script_from_a_source_runs_the_text_read_from_it", async () => {
      const request = scriptOf({
        code: null,
        source: {
          name: null,
          endpoint: {
            uri: `${sources.origin}/greet.js`,
            authentication: null,
          },
        },
        arguments: { greeting: "hi" },
      });

      await client.run(request, contextOf());

      expect(commandSent()).toMatchObject({
        copyIn: {
          script: { content: 'const greeting = "hi";\nconsole.log(greeting);' },
        },
      });
    });

    it("a_script_whose_source_the_server_does_not_have_is_rejected_with_its_status", async () => {
      const request = scriptOf({
        code: null,
        source: {
          name: null,
          endpoint: {
            uri: `${sources.origin}/missing.js`,
            authentication: null,
          },
        },
      });

      const outcome = await client.run(request, contextOf());

      expect(outcome).toEqual({
        kind: "rejected",
        statusCode: 404,
        detail: "The server answered the resource with status 404",
      });
      expect(sandbox.received).toHaveLength(0);
    });

    it("a_script_whose_source_needs_a_secret_the_run_does_not_hold_is_forbidden", async () => {
      const request = scriptOf({
        code: null,
        source: {
          name: null,
          endpoint: {
            uri: `${sources.origin}/greet.js`,
            authentication: {
              kind: "secret",
              scheme: "bearer",
              secret: "scripts",
            },
          },
        },
      });

      const outcome = await client.run(request, contextOf());

      expect(outcome).toEqual({
        kind: "forbidden",
        detail: "The secret is not among the secrets of this run",
      });
      expect(sandbox.received).toHaveLength(0);
    });

    it("the_time_limit_is_the_nearer_of_the_deadline_and_the_sandbox_s", async () => {
      await client.run(shellOf(), contextOf(5_000));

      const limit = Number(commandSent().clockLimit);
      expect(limit).toBeGreaterThan(4_000_000_000);
      expect(limit).toBeLessThanOrEqual(5_000_000_000);
    });
  });
});
