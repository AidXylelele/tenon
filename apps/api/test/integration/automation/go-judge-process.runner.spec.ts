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
import { ResilienceModule } from '../../../src/frameworks/di/resilience.module.js';
import { createSandboxPool } from '../../../src/frameworks/undici/sandbox-pool.js';
import { GoJudgeProcessRunner } from '../../../src/interface-adapters/sandbox/go-judge-process.runner.js';

const TOKEN = 'integration-sandbox-token-0123456789abcdef';
const at = JsonPointer.root().at('do').at(0).at('run');

function script(language: ScriptLanguage, process: JsonObject): ProcessRun {
  return { id: 'task-1:process', kind: RunKind.Script, language, process };
}

describe('GoJudgeProcessRunner', () => {
  let container: StartedTestContainer;
  let runner: GoJudgeProcessRunner;

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
    const url = `http://${container.getHost()}:${String(container.getMappedPort(5050))}`;
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule],
    }).compile();
    runner = new GoJudgeProcessRunner(
      createSandboxPool(url, TOKEN),
      {
        seconds: 2,
        memoryBytes: 128 * 1024 * 1024,
        processes: 16,
        outputBytes: 1024 * 1024,
      },
      moduleRef.get(ResilienceService),
    );
  }, 600_000);

  afterAll(async () => {
    await container.stop();
  });

  it('a_script_runs_with_its_arguments_and_its_output_follows_return', async () => {
    const run = script(ScriptLanguage.JavaScript, {
      code: "console.log(process.argv.slice(2).join(','))",
      arguments: ['a', 'b'],
    });

    const [result] = await runner.runAll([run]);

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

    const [result] = await runner.runAll([run]);

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
    };

    const [result] = await runner.runAll([run]);

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

    const [result] = await runner.runAll([run]);

    expect(result?.outcome(ProcessReturn.Stdout, at).output).toBe('refused\n');
  });

  it('a_script_past_its_time_limit_is_stopped_with_a_timeout_error', async () => {
    const run = script(ScriptLanguage.JavaScript, { code: 'for (;;) {}' });
    const started = Date.now();

    const [result] = await runner.runAll([run]);

    expect(result?.outcome(ProcessReturn.Stdout, at).failure?.status).toBe(408);
    expect(Date.now() - started).toBeLessThan(2000 + 1000 + 1000);
  });

  it('a_script_past_its_memory_limit_is_stopped_with_a_runtime_error', async () => {
    const run = script(ScriptLanguage.Python, {
      code: "data = bytearray(512 * 1024 * 1024)\nprint('allocated')",
    });

    const [result] = await runner.runAll([run]);

    expect(result?.outcome(ProcessReturn.Stdout, at).failure?.status).toBe(500);
  });
});
