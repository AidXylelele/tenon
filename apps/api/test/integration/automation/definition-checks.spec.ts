import { Test } from '@nestjs/testing';
import { WorkflowsModule } from '@nestjs/workflows';
import type { INestApplicationContext } from '@nestjs/common';
import type { JsonObject } from '../../../src/domain/automation/json.js';
import { ConfigModule } from '../../../src/frameworks/di/config.module.js';
import { ResilienceModule } from '../../../src/frameworks/di/resilience.module.js';
import { RuntimeModule } from '../../../src/frameworks/di/runtime.module.js';
import { VerdictKind } from '../../../src/interface-adapters/workflows/enums.js';
import {
  type CheckVerdict,
  RuntimeChecks,
} from '../../../src/interface-adapters/workflows/interfaces.js';
import { aDocument } from '../../support/builders.js';

let context: INestApplicationContext;
let checks: RuntimeChecks;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    // The engine's in-memory store: a cron is checked by the engine's own reading of it.
    imports: [
      ConfigModule,
      ResilienceModule,
      WorkflowsModule.forRoot({ worker: false, allowInMemoryStorage: true }),
      RuntimeModule,
    ],
  }).compile();
  context = await moduleRef.init();
  checks = context.get(RuntimeChecks);
});

afterAll(async () => {
  await context.close();
});

function documentWith(tasks: JsonObject[], rest: JsonObject = {}): JsonObject {
  const document = aDocument({}, tasks);
  return { ...document, ...rest };
}

async function problemOf(document: JsonObject): Promise<unknown> {
  const verdict: CheckVerdict = await checks.check(document);

  if (verdict.kind === VerdictKind.Valid) return null;

  return verdict.problem;
}

describe('the checks a document passes before it is published', () => {
  it('a_valid_document_gives_its_identity_and_a_fingerprint_of_its_content', async () => {
    const verdict = await checks.check(aDocument());

    expect(verdict.kind).toBe(VerdictKind.Valid);
    const identity =
      verdict.kind === VerdictKind.Valid ? verdict.identity : null;
    expect(identity).toMatchObject({
      namespace: 'sales',
      name: 'route-lead',
      version: '1.0.0',
      dsl: '1.0.3',
    });
    expect(identity?.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('the_fingerprint_ignores_the_order_of_keys', async () => {
    const reordered: JsonObject = {
      do: [{ greet: { set: { greeting: 'hello' } } }],
      document: {
        version: '1.0.0',
        name: 'route-lead',
        namespace: 'sales',
        dsl: '1.0.3',
      },
    };

    const first = await checks.check(aDocument());
    const second = await checks.check(reordered);

    const fingerprintOf = (verdict: CheckVerdict) =>
      verdict.kind === VerdictKind.Valid ? verdict.identity.fingerprint : null;
    expect(fingerprintOf(second)).toBe(fingerprintOf(first));
  });

  it('a_misspelled_property_is_located_at_that_property', async () => {
    const document = documentWith([{ greet: { set: { x: 1 }, thn: 'end' } }]);

    expect(await problemOf(document)).toEqual({
      pointer: '/do/0/greet/thn',
      detail: "'thn' is not a property here",
    });
  });

  it('a_task_without_a_kind_is_named_so', async () => {
    const document = documentWith([{ greet: { sett: { x: 1 } } }]);

    expect(await problemOf(document)).toEqual({
      pointer: '/do/0/greet',
      detail: expect.stringContaining('declares no kind') as unknown,
    });
  });

  it('a_defect_inside_a_nested_task_is_located_in_that_task', async () => {
    const document = documentWith([
      {
        loop: {
          for: { in: '${ .items }' },
          do: [{ inner: { set: { x: 1 }, bogus: true } }],
        },
      },
    ]);

    expect(await problemOf(document)).toEqual({
      pointer: '/do/0/loop/do/0/inner/bogus',
      detail: "'bogus' is not a property here",
    });
  });

  it('a_missing_property_is_named', async () => {
    const document = documentWith([
      { fetch: { call: 'http', with: { method: 'get' } } },
    ]);

    expect(await problemOf(document)).toEqual({
      pointer: '/do/0/fetch/with',
      detail: "missing property 'endpoint'",
    });
  });

  it('a_pre_release_dsl_is_refused', async () => {
    const document = aDocument({ dsl: '1.0.0-alpha5' });

    expect(await problemOf(document)).toMatchObject({
      pointer: '/document/dsl',
    });
  });

  it('a_property_beyond_the_1_0_3_root_is_refused', async () => {
    const document = documentWith([{ greet: { set: { x: 1 } } }], {
      evaluate: { language: 'jq' },
    });

    expect(await problemOf(document)).toMatchObject({ pointer: '/evaluate' });
  });

  it('a_name_used_twice_in_a_list_is_refused', async () => {
    const document = documentWith([
      { greet: { set: { x: 1 } } },
      { greet: { set: { x: 2 } } },
    ]);

    expect(await problemOf(document)).toEqual({
      pointer: '/do/1/greet',
      detail: "the task name 'greet' is used twice in this list",
    });
  });

  it('then_naming_no_task_of_its_list_is_refused', async () => {
    const document = documentWith([
      { greet: { set: { x: 1 }, then: 'nowhere' } },
    ]);

    expect(await problemOf(document)).toEqual({
      pointer: '/do/0/greet/then',
      detail: "no task named 'nowhere' in this list",
    });
  });

  it('then_naming_a_task_of_an_outer_list_is_refused', async () => {
    const document = documentWith([
      { outer: { do: [{ inner: { set: { x: 1 }, then: 'last' } }] } },
      { last: { set: { y: 1 } } },
    ]);

    expect(await problemOf(document)).toMatchObject({
      pointer: '/do/0/outer/do/0/inner/then',
    });
  });

  it('a_switch_case_naming_no_task_is_refused', async () => {
    const document = documentWith([
      {
        route: {
          switch: [{ high: { when: '${ .amount > 1 }', then: 'nowhere' } }],
        },
      },
    ]);

    expect(await problemOf(document)).toMatchObject({
      pointer: '/do/0/route/switch/0/high/then',
    });
  });

  it.each([
    ['a function', { call: 'notify' }, '/do/0/task/call', 'functions'],
    [
      'an error',
      { raise: { error: 'notFound' } },
      '/do/0/task/raise/error',
      'errors',
    ],
    [
      'a timeout',
      { set: { x: 1 }, timeout: 'short' },
      '/do/0/task/timeout',
      'timeouts',
    ],
  ])('%s_not_declared_in_use_is_refused', async (_, task, pointer, section) => {
    const document = documentWith([{ task: task }]);

    expect(await problemOf(document)).toEqual({
      pointer,
      detail: expect.stringContaining(`use.${section}`) as unknown,
    });
  });

  it('an_authentication_by_name_not_declared_is_refused', async () => {
    const document = documentWith([
      {
        fetch: {
          call: 'http',
          with: {
            method: 'get',
            endpoint: {
              uri: 'https://crm.example.com/leads',
              authentication: { use: 'crm' },
            },
          },
        },
      },
    ]);

    expect(await problemOf(document)).toMatchObject({
      pointer: '/do/0/fetch/with/endpoint/authentication/use',
    });
  });

  it.each([
    [
      'grpc',
      {
        call: 'grpc',
        with: {
          proto: { endpoint: 'https://x.example/p' },
          service: { name: 's', host: 'h' },
          method: 'm',
        },
      },
      '/do/0/task/call',
    ],
    [
      'a container',
      { run: { container: { image: 'alpine' } } },
      '/do/0/task/run/container',
    ],
    [
      'a script language',
      { run: { script: { language: 'ruby', code: 'puts 1' } } },
      '/do/0/task/run/script/language',
    ],
  ])('%s_outside_the_subset_is_refused', async (_, task, pointer) => {
    const document = documentWith([{ task: task }]);

    expect(await problemOf(document)).toMatchObject({ pointer });
  });

  it('digest_authentication_is_refused', async () => {
    const document = documentWith([{ greet: { set: { x: 1 } } }], {
      use: {
        authentications: { crm: { digest: { username: 'u', password: 'p' } } },
      },
    });

    expect(await problemOf(document)).toMatchObject({
      pointer: '/use/authentications/crm/digest',
    });
  });

  it('an_oauth2_grant_other_than_client_credentials_is_refused', async () => {
    const document = documentWith([{ greet: { set: { x: 1 } } }], {
      use: {
        authentications: {
          crm: {
            oauth2: {
              authority: 'https://id.example.com',
              grant: 'password',
              username: 'u',
              password: 'p',
            },
          },
        },
      },
    });

    expect(await problemOf(document)).toMatchObject({
      pointer: '/use/authentications/crm/oauth2/grant',
    });
  });

  it.each([
    ['a calendar unit', 'P1M'],
    ['weeks', 'P1W'],
  ])('a_duration_in_%s_is_refused', async (_, duration) => {
    const document = documentWith([{ pause: { wait: duration } }]);

    expect(await problemOf(document)).toMatchObject({
      pointer: '/do/0/pause/wait',
    });
  });

  it('a_retry_delay_given_as_an_expression_is_refused', async () => {
    const document = documentWith([
      {
        guarded: {
          try: [{ fetch: { set: { x: 1 } } }],
          catch: {
            retry: { delay: '${ .delay }', limit: { attempt: { count: 2 } } },
          },
        },
      },
    ]);

    expect(await problemOf(document)).toMatchObject({
      pointer: '/do/0/guarded/catch/retry/delay',
    });
  });

  it('an_expression_that_does_not_compile_is_located', async () => {
    const document = documentWith([{ greet: { set: { x: '${ .a | }' } } }]);

    expect(await problemOf(document)).toEqual({
      pointer: '/do/0/greet/set/x',
      detail: expect.stringContaining('does not compile') as unknown,
    });
  });

  it('secrets_outside_the_workflow_input_from_are_refused', async () => {
    const document = documentWith([
      { greet: { set: { x: '${ $secrets.token }' } } },
    ]);

    expect(await problemOf(document)).toMatchObject({
      pointer: '/do/0/greet/set/x',
    });
  });

  it('an_author_schema_that_does_not_compile_is_located', async () => {
    const document = documentWith([{ greet: { set: { x: 1 } } }], {
      input: { schema: { format: 'json', document: { type: 'nonsense' } } },
    });

    expect(await problemOf(document)).toMatchObject({
      pointer: '/input/schema/document',
    });
  });

  it('a_schema_from_an_external_resource_is_refused', async () => {
    const document = documentWith([{ greet: { set: { x: 1 } } }], {
      input: {
        schema: {
          format: 'json',
          resource: { endpoint: 'https://x.example/s.json' },
        },
      },
    });

    expect(await problemOf(document)).toMatchObject({
      pointer: '/input/schema/resource',
    });
  });

  it.each([
    [
      'a_listen_over_a_stream',
      {
        listen: { to: { one: { with: { type: 'order.placed' } } } },
        foreach: { item: 'order' },
      },
      '/do/0/task/foreach',
    ],
    [
      'a_listen_until_other_events',
      {
        listen: {
          to: {
            any: [{ with: { type: 'order.placed' } }],
            until: { one: { with: { type: 'order.closed' } } },
          },
        },
      },
      '/do/0/task/listen/to/until',
    ],
  ])('%s_is_refused', async (_, task, pointer) => {
    const document = documentWith([{ task: task }]);

    expect(await problemOf(document)).toMatchObject({ pointer });
  });

  it('a_listen_until_an_expression_is_accepted', async () => {
    const document = documentWith([
      {
        task: {
          listen: {
            to: {
              any: [{ with: { type: 'order.placed' } }],
              until: '${ length > 2 }',
            },
          },
        },
      },
    ]);

    expect(await problemOf(document)).toBeNull();
  });

  it('a_schedule_on_all_of_several_events_is_refused', async () => {
    const document = documentWith([{ greet: { set: { x: 1 } } }], {
      schedule: {
        on: {
          all: [
            { with: { type: 'order.placed' } },
            { with: { type: 'order.paid' } },
          ],
        },
      },
    });

    expect(await problemOf(document)).toMatchObject({
      pointer: '/schedule/on/all',
    });
  });
});
