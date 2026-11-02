import { fileURLToPath } from 'node:url';
import { Test } from '@nestjs/testing';
import { ResilienceService } from '@nestjs/resilience';
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';
import {
  RunKind,
  ScriptLanguage,
} from '../../../src/domain/automation/language/enums.js';
import type {
  JsonObject,
  ProcessRun,
} from '../../../src/domain/automation/language/interfaces.js';
import { JsonPointer } from '../../../src/domain/automation/language/json-pointer.js';
import { ProcessReturn } from '../../../src/domain/automation/language/process-return.js';
import { ProcessTimedOut } from '../../../src/domain/automation/language/results/process-timed-out.js';
import { ResilienceModule } from '../../../src/frameworks/di/resilience.module.js';
import { GoJudgeSandboxClient } from '../../../src/frameworks/go-judge/go-judge-sandbox.client.js';
import { createSandboxPool } from '../../../src/frameworks/go-judge/sandbox-pool.js';
import { SystemClock } from '../../support/instance-fakes.js';
import type { GoJudgeFile } from '../../../src/interface-adapters/sandbox/interfaces.js';
import { SandboxGateway } from '../../../src/interface-adapters/sandbox/sandbox.gateway.js';

const TOKEN = 'integration-sandbox-token-0123456789abcdef';
const limits = {
  seconds: 2,
  memoryBytes: 128 * 1024 * 1024,
  processes: 16,
  outputBytes: 1024 * 1024,
};
const at = JsonPointer.root().at('do').at(0).at('run');
const clock = new SystemClock();

function script(language: ScriptLanguage, process: JsonObject): ProcessRun {
  return {
    id: 'task-1:process',
    kind: RunKind.Script,
    language,
    process,
    deadline: null,
  };
}

describe('SandboxGateway', () => {
  let container: StartedTestContainer;
  let runner: SandboxGateway;
  let client: GoJudgeSandboxClient;
  let url: string;

  beforeAll(async () => {
    const context = fileURLToPath(
      new URL('../../../../../docker/go-judge', import.meta.url),
    );
    const image = await GenericContainer.fromDockerfile(context).build(
      'workflow-platform/go-judge:test',
      { deleteOnExit: false },
    );
    container = await image
      .withPrivilegedMode()
      .withEnvironment({ ES_AUTH_TOKEN: TOKEN })
      .withExposedPorts(5050)
      .withWaitStrategy(
        Wait.forHttp('/version', 5050).withHeaders({
          authorization: `Bearer ${TOKEN}`,
        }),
      )
      .start();
    url = `http://${container.getHost()}:${String(container.getMappedPort(5050))}`;
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule],
    }).compile();
    const pool = createSandboxPool(url, TOKEN, limits);
    client = new GoJudgeSandboxClient(pool, moduleRef.get(ResilienceService));
    runner = new SandboxGateway(client, limits, clock);
  }, 600_000);

  afterAll(async () => {
    await container.stop();
  });

  it('a_script_runs_with_its_arguments_and_its_output_follows_return', async () => {
    const run = script(ScriptLanguage.JavaScript, {
      code: "console.log(process.argv.slice(2).join(','))",
      arguments: ['a', 'b'],
    });

    const result = await runner.run(run);

    expect(result?.outcome(ProcessReturn.All, at).output).toEqual({
      code: 0,
      stdout: 'a,b\n',
      stderr: '',
    });
  });

  it('a_non_zero_exit_is_not_an_error', async () => {
    const run = script(ScriptLanguage.Python, {
      code: 'import sys\nsys.exit(3)',
    });

    const result = await runner.run(run);

    expect(result?.outcome(ProcessReturn.Code, at).output).toBe(3);
  });

  it('a_shell_command_reads_its_stdin_and_environment', async () => {
    const run: ProcessRun = {
      id: 'task-1:process',
      kind: RunKind.Shell,
      language: null,
      process: {
        command: 'cat; echo " $GREETING $1"',
        arguments: ['world'],
        environment: { GREETING: 'hello' },
        stdin: 'in',
      },
      deadline: null,
    };

    const result = await runner.run(run);

    expect(result?.outcome(ProcessReturn.Stdout, at).output).toBe(
      'in hello world\n',
    );
  });

  it('a_script_cannot_open_a_network_connection', async () => {
    const run = script(ScriptLanguage.JavaScript, {
      code: [
        "const socket = require('node:net').connect(80, '1.1.1.1');",
        "socket.on('connect', () => { console.log('connected'); socket.destroy(); });",
        "socket.on('error', () => console.log('refused'));",
      ].join('\n'),
    });

    const result = await runner.run(run);

    expect(result?.outcome(ProcessReturn.Stdout, at).output).toBe('refused\n');
  });

  it('a_script_past_its_time_limit_is_stopped_with_a_timeout_error', async () => {
    const run = script(ScriptLanguage.JavaScript, { code: 'for (;;) {}' });
    const started = Date.now();

    const result = await runner.run(run);

    expect(result?.outcome(ProcessReturn.Stdout, at).failure?.status).toBe(408);
    expect(Date.now() - started).toBeLessThan(2000 + 1000 + 1000);
  });

  it('a_script_past_its_memory_limit_is_stopped_with_a_runtime_error', async () => {
    const run = script(ScriptLanguage.Python, {
      code: "data = bytearray(512 * 1024 * 1024)\nprint('allocated')",
    });

    const result = await runner.run(run);

    expect(result?.outcome(ProcessReturn.Stdout, at).failure?.status).toBe(500);
  });

  it('a_sandbox_that_is_down_or_refuses_gives_no_result_so_the_run_waits', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule],
    }).compile();
    const resilience = moduleRef.get(ResilienceService);
    const url = `http://${container.getHost()}:${String(container.getMappedPort(5050))}`;
    const tiny = { seconds: 2, memoryBytes: 1, processes: 1, outputBytes: 1 };
    const refusing = new SandboxGateway(
      new GoJudgeSandboxClient(
        createSandboxPool(url, 'wrong-token', tiny),
        resilience,
      ),
      tiny,
      clock,
    );
    const down = new SandboxGateway(
      new GoJudgeSandboxClient(
        createSandboxPool('http://127.0.0.1:9', TOKEN, tiny),
        resilience,
      ),
      tiny,
      clock,
    );
    const run = script(ScriptLanguage.JavaScript, { code: 'console.log(1)' });

    const refused = await refusing.run(run);
    const unreachable = await down.run(run);

    expect(refused).toBeNull();
    expect(unreachable).toBeNull();
  });

  it('output_that_json_escapes_six_times_over_comes_back_whole', async () => {
    const run = script(ScriptLanguage.Python, { code: "print('<' * 800_000)" });

    const result = await runner.run(run);

    const stdout = result?.outcome(ProcessReturn.Stdout, at).output;
    expect(typeof stdout === 'string' && stdout.length).toBe(800_001);
  });

  it('an_answer_beyond_the_pool_bound_faults_the_task_instead_of_waiting', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule],
    }).compile();
    const narrow = { ...limits, outputBytes: 1024 };
    const bounded = new SandboxGateway(
      new GoJudgeSandboxClient(
        createSandboxPool(url, TOKEN, narrow),
        moduleRef.get(ResilienceService),
      ),
      limits,
      clock,
    );
    const run = script(ScriptLanguage.Python, { code: "print('<' * 200_000)" });

    const result = await bounded.run(run);

    expect(result?.outcome(ProcessReturn.Stdout, at).failure?.detail).toBe(
      'The output of the process is larger than the sandbox answers',
    );
  });

  it('a_command_go_judge_refuses_is_an_answer_not_an_outage', async () => {
    // go-judge answers 404 with its message for a file it does not hold.
    const missing = { fileId: 'missing' } as unknown as GoJudgeFile;
    const outcome = await client.run({
      args: ['/bin/true'],
      env: [],
      files: [],
      cpuLimit: 1_000_000_000,
      clockLimit: 1_000_000_000,
      memoryLimit: 64 * 1024 * 1024,
      procLimit: 1,
      copyIn: { 'a.txt': missing },
    });

    expect(outcome).toEqual({ kind: 'failed' });
  });

  it('a_process_stops_at_its_task_deadline', async () => {
    const deadline = new Date(Date.now() + 1000);
    const run: ProcessRun = {
      id: 'task-1:process',
      kind: RunKind.Script,
      language: ScriptLanguage.JavaScript,
      process: { code: 'setTimeout(() => console.log("late"), 10000);' },
      deadline,
    };
    const started = performance.now();

    const result = await runner.run(run);

    const elapsed = performance.now() - started;
    expect(result).toBeInstanceOf(ProcessTimedOut);
    expect(elapsed).toBeLessThan(5000);
  });

  it('output_holding_a_nul_character_faults_the_task', async () => {
    const run = script(ScriptLanguage.JavaScript, {
      code: 'process.stdout.write("a\\u0000b")',
    });

    const result = await runner.run(run);

    expect(result?.outcome(ProcessReturn.Stdout, at).failure?.detail).toBe(
      'The process wrote a NUL character, which a value cannot hold',
    );
  });
});
