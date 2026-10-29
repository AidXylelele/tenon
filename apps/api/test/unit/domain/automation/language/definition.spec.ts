import { Definition } from '../../../../../src/domain/automation/language/definition.js';
import type {
  ParsedDocument,
  ParsedTaskList,
  ParsedUse,
} from '../../../../../src/domain/automation/language/interfaces.js';

function documentWith(tasks: ParsedTaskList, use?: ParsedUse): ParsedDocument {
  return {
    document: {
      dsl: '1.0.3',
      namespace: 'default',
      name: 'sample',
      version: '1.0.0',
    },
    use,
    do: tasks,
  };
}

function reasonsOf(document: ParsedDocument): Record<string, string> {
  const build = Definition.build(document);
  const reasons: Record<string, string> = {};

  for (const problem of build.problems)
    reasons[problem.pointer] = problem.reason;

  return reasons;
}

describe('Definition', () => {
  it('a_document_with_every_supported_task_builds_a_definition', () => {
    const document = documentWith([
      { setColor: { set: { color: '${ .color }' } } },
      {
        pickColor: {
          switch: [
            { red: { when: '.color == "red"', then: 'paint' } },
            { other: { then: 'exit' } },
          ],
        },
      },
      {
        paint: {
          for: { each: 'shade', in: '.shades' },
          do: [{ mix: { set: { mixed: true } } }],
        },
      },
      {
        branches: {
          fork: {
            branches: [
              { left: { set: { side: 'left' } } },
              { right: { set: { side: 'right' } } },
            ],
          },
        },
      },
      {
        guarded: {
          try: [
            {
              fail: {
                raise: {
                  error: { type: 'https://example.com/errors/x', status: 400 },
                },
              },
            },
          ],
          catch: {
            as: 'failure',
            retry: {
              delay: 'PT1S',
              backoff: { exponential: {} },
              limit: { attempt: { count: 3 } },
            },
          },
        },
      },
      {
        announce: {
          emit: {
            event: {
              with: { source: 'https://example.com', type: 'com.example.done' },
            },
          },
        },
      },
      {
        fetch: {
          call: 'http',
          with: { method: 'get', endpoint: 'https://example.com/pets' },
        },
      },
      {
        child: {
          run: {
            workflow: { namespace: 'default', name: 'child', version: '1.0.0' },
          },
        },
      },
      { script: { run: { script: { language: 'python', code: 'print(1)' } } } },
      { shell: { run: { shell: { command: 'echo hello' } } } },
    ]);

    const build = Definition.build(document);

    expect(build.problems).toEqual([]);
    expect(build.definition?.workflow.name).toBe('sample');
    expect(build.definition?.body.tasks.map((task) => task.name)).toEqual([
      'setColor',
      'pickColor',
      'paint',
      'branches',
      'guarded',
      'announce',
      'fetch',
      'child',
      'script',
      'shell',
    ]);
  });

  it('every_problem_is_reported_at_once_with_its_location', () => {
    const document: ParsedDocument = {
      document: {
        dsl: '1.0.4',
        namespace: 'default',
        name: 'broken',
        version: '1.0.0',
      },
      use: {
        secrets: ['token'],
        catalogs: { global: { endpoint: 'https://example.com' } },
      },
      schedule: { every: 'PT1M' },
      do: [
        { first: { set: { a: 1 }, then: 'nowhere' } },
        { first: { wait: 'PT1S' } },
        { remote: { call: 'grpc', with: { proto: 'x' } } },
        { boxed: { run: { container: { image: 'alpine' } } } },
        {
          sourced: {
            run: {
              script: {
                language: 'python',
                source: { endpoint: 'https://example.com/a.py' },
              },
            },
          },
        },
        { unknownFunction: { call: 'sendSlack' } },
        { empty: { fork: { branches: [] } } },
        { late: { set: { b: 2 }, timeout: { after: 'P1.5D' } } },
        { negative: { set: { c: 3 }, timeout: { after: { seconds: -1 } } } },
        {
          digest: {
            call: 'http',
            with: {
              method: 'get',
              endpoint: {
                uri: 'https://example.com',
                authentication: { digest: { username: 'u', password: 'p' } },
              },
            },
          },
        },
      ],
    };

    const reasons = reasonsOf(document);

    expect(reasons).toEqual({
      '/document/dsl':
        'DSL 1.0.4 is not supported; documents must declare 1.0.0 to 1.0.3',
      '/schedule': 'schedule is outside the supported subset',
      '/use/catalogs':
        'catalogs, the default catalog included is outside the supported subset',
      '/use/secrets': 'use.secrets is outside the supported subset',
      '/do/1/first': 'Another task in this list is named "first"',
      '/do/1/first/wait': 'the wait task is outside the supported subset',
      '/do/2/remote/call':
        'call with grpc, asyncapi, a2a or mcp is outside the supported subset',
      '/do/3/boxed/run/container':
        'run with container is outside the supported subset',
      '/do/4/sourced/run/script/source':
        'a script source (an external resource) is outside the supported subset',
      '/do/5/unknownFunction/call':
        'No function named "sendSlack" is declared in use.functions',
      '/do/6/empty/fork/branches': 'A fork needs at least one branch',
      '/do/7/late/timeout/after':
        'a fraction of years, months, weeks or days in a duration is outside the supported subset',
      '/do/8/negative/timeout/after': 'A duration cannot be negative',
      '/do/9/digest/with/endpoint/authentication/digest':
        'digest authentication is outside the supported subset',
      '/do/0/first/then': '"nowhere" is not a task of this list',
    });
    expect(Definition.build(document).definition).toBeNull();
  });

  it('a_reusable_component_that_is_not_declared_is_refused_where_it_is_named', () => {
    const document = documentWith([
      { fail: { raise: { error: 'missingError' } } },
      {
        guarded: {
          try: [{ step: { set: { a: 1 } } }],
          catch: { retry: 'missingRetry' },
        },
      },
      { slow: { set: { b: 1 }, timeout: 'missingTimeout' } },
      {
        secured: {
          call: 'http',
          with: {
            method: 'get',
            endpoint: {
              uri: 'https://example.com',
              authentication: { use: 'missingAuth' },
            },
          },
        },
      },
    ]);

    const reasons = reasonsOf(document);

    expect(reasons).toEqual({
      '/do/0/fail/raise/error':
        'No error named "missingError" is declared in use.errors',
      '/do/1/guarded/catch/retry':
        'No retry policy named "missingRetry" is declared in use.retries',
      '/do/2/slow/timeout':
        'No timeout named "missingTimeout" is declared in use.timeouts',
      '/do/3/secured/with/endpoint/authentication/use':
        'No authentication named "missingAuth" is declared in use.authentications',
    });
  });

  it('declared_reusable_components_are_resolved_by_name', () => {
    const document = documentWith(
      [
        { fail: { raise: { error: 'notAllowed' } } },
        {
          guarded: {
            try: [{ step: { call: 'getPet' } }],
            catch: { retry: 'twice' },
          },
        },
        { slow: { set: { a: 1 }, timeout: 'short' } },
      ],
      {
        errors: {
          notAllowed: {
            type: 'https://example.com/errors/denied',
            status: 403,
          },
        },
        retries: { twice: { limit: { attempt: { count: 2 } } } },
        timeouts: { short: { after: 'PT5S' } },
        authentications: { petstore: { bearer: { token: 'abc' } } },
        functions: {
          getPet: {
            call: 'http',
            with: {
              method: 'get',
              endpoint: {
                uri: 'https://example.com',
                authentication: { use: 'petstore' },
              },
            },
          },
        },
      },
    );

    const build = Definition.build(document);

    expect(build.problems).toEqual([]);
  });

  it('runtime_expressions_are_collected_with_their_locations', () => {
    const document = documentWith([
      {
        loop: {
          if: '${ .enabled }',
          for: { in: '.items' },
          while: '.count < 3',
          input: { from: '.payload' },
          output: { as: { total: '${ .sum }', fixed: 'plain text' } },
          do: [{ step: { set: { value: '${ $item }' } } }],
        },
      },
    ]);

    const build = Definition.build(document);
    const located = build.expressions.map((expression) => [
      expression.pointer,
      expression.program,
    ]);

    expect(located).toEqual([
      ['/do/0/loop/if', '.enabled'],
      ['/do/0/loop/input/from', '.payload'],
      ['/do/0/loop/output/as/total', '.sum'],
      ['/do/0/loop/for/in', '.items'],
      ['/do/0/loop/while', '.count < 3'],
      ['/do/0/loop/do/0/step/set/value', '$item'],
    ]);
  });

  it('a_sub_workflow_is_recorded_as_a_reference_with_latest_by_default', () => {
    const document = documentWith([
      {
        pinned: {
          run: {
            workflow: {
              namespace: 'billing',
              name: 'invoice',
              version: '2.0.0',
            },
          },
        },
      },
      {
        floating: {
          run: { workflow: { namespace: 'billing', name: 'receipt' } },
        },
      },
    ]);

    const build = Definition.build(document);
    const targets = build.targets.map((target) => [
      target.workflow.toString(),
      target.version,
    ]);

    expect(targets).toEqual([
      ['billing/invoice', '2.0.0'],
      ['billing/receipt', 'latest'],
    ]);
  });
});
