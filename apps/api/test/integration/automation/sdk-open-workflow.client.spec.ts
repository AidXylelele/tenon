import { ResilienceService } from '@nestjs/resilience';
import { Test } from '@nestjs/testing';
import { DslOutcomeKind } from '../../../src/interface-adapters/workflows/definitions/enums.js';
import { ResilienceModule } from '../../../src/frameworks/di/resilience.module.js';
import { SdkOpenWorkflowClient } from '../../../src/frameworks/openworkflowspec/sdk-open-workflow.client.js';

function header(dsl: string, tasks: string): string {
  return `document:\n  dsl: '${dsl}'\n  namespace: default\n  name: sample\n  version: '1.0.0'\ndo:\n${tasks}`;
}

describe('SdkOpenWorkflowClient', () => {
  let client: SdkOpenWorkflowClient;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule],
    }).compile();
    client = new SdkOpenWorkflowClient(moduleRef.get(ResilienceService));
  });

  afterAll(async () => {
    await client.onApplicationShutdown();
  });

  it('a_valid_document_comes_back_as_plain_data', async () => {
    const outcome = await client.parse(
      header('1.0.3', '  - greet:\n      set:\n        x: 1\n'),
    );

    const plain = {
      document: {
        dsl: '1.0.3',
        namespace: 'default',
        name: 'sample',
        version: '1.0.0',
      },
      do: [{ greet: { set: { x: 1 } } }],
    };
    expect(outcome).toEqual({
      kind: DslOutcomeKind.Parsed,
      workflow: plain,
      document: plain,
    });
  });

  it('a_yaml_syntax_error_fails_at_the_root', async () => {
    const outcome = await client.parse('document: [unclosed');

    expect(outcome).toEqual({
      kind: DslOutcomeKind.Failure,
      pointer: '',
      failure: 'unexpected end of the stream within a flow collection (1:20)',
    });
  });

  it('a_schema_violation_fails_where_it_stands', async () => {
    const outcome = await client.parse(
      "document:\n  dsl: '1.0.3'\n  namespace: default\n  name: sample\n  version: '1.0.0'\ndo: {}\n",
    );

    expect(outcome).toEqual({
      kind: DslOutcomeKind.Failure,
      pointer: '/do',
      failure: 'must be array',
    });
  });

  it('a_dsl_version_outside_the_standard_fails', async () => {
    const outcome = await client.parse(
      header('2.0.0', '  - greet:\n      set:\n        x: 1\n'),
    );

    expect(outcome).toMatchObject({
      kind: DslOutcomeKind.Failure,
      pointer: '',
    });
    expect(outcome).toHaveProperty(
      'failure',
      expect.stringContaining("'2.0.0' does not satisfy"),
    );
  });

  it('two_tasks_with_one_name_fail_at_their_list', async () => {
    const outcome = await client.parse(
      header(
        '1.0.3',
        '  - greet:\n      set:\n        x: 1\n  - greet:\n      set:\n        y: 1\n',
      ),
    );

    expect(outcome).toEqual({
      kind: DslOutcomeKind.Failure,
      pointer: '/do',
      failure:
        "'TaskList' is invalid - The following task names are duplicated: 'greet'.",
    });
  });
});
