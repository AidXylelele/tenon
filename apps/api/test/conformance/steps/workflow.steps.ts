import { ManualWorkflowClock, WorkflowWorker } from '@nestjs/workflows';
import { Classes } from '@openworkflowspec/sdk';
import { Given, Then, When, type QuickPickleWorld } from 'quickpickle';
import request from 'supertest';
import { MockAgent } from 'undici';
import { Role } from '../../../src/domain/identity/enums.js';
import { EngineClock } from '../../../src/interface-adapters/workflows/runs/engine.clock.js';
import { EndpointDispatcher } from '../../../src/frameworks/undici/endpoint-dispatcher.js';
import { authHeaders, createUser, signIn } from '../../support/auth-helpers.js';
import { createTestApp, type TestApp } from '../../support/create-test-app.js';
import { truncateAll } from '../../support/db.js';

// The one recorded contradiction (FR-032, research R16): the scenario filters on an error type
// the specification does not define, so the platform faults where the kit expects completion.
const CONTRADICTION = 'Try Handle Caught Error';

const JSON_TYPE = { 'content-type': 'application/json' };

interface Execution {
  readonly phase: string;
  readonly output: unknown;
  readonly error: Record<string, unknown> | null;
  readonly tasks: readonly string[];
}

let app: TestApp | null = null;
let editor: Record<string, string> = {};

function stubs(): MockAgent {
  const agent = new MockAgent();
  agent.disableNetConnect();
  const petstore = agent.get('https://petstore.swagger.io');
  const pet = (id: number) => ({
    id,
    name: `pet-${String(id)}`,
    status: 'available',
  });
  petstore
    .intercept({ path: '/v2/pet/findByStatus?status=available', method: 'GET' })
    .reply(200, [pet(1), pet(2)], { headers: JSON_TYPE })
    .persist();
  petstore
    .intercept({ path: '/v2/pet/1', method: 'GET' })
    .reply(200, pet(1), { headers: JSON_TYPE })
    .persist();
  petstore
    .intercept({ path: '/v2/pet/2', method: 'GET' })
    .reply(200, pet(2), { headers: JSON_TYPE })
    .persist();
  petstore
    .intercept({ path: /^\/v2\/pet\/getPetByName\//, method: 'GET' })
    .reply(404, { code: 404, message: 'Pet not found' }, { headers: JSON_TYPE })
    .persist();
  petstore
    .intercept({ path: '/v2/swagger.json', method: 'GET' })
    .reply(
      200,
      {
        swagger: '2.0',
        host: 'petstore.swagger.io',
        basePath: '/v2',
        schemes: ['https'],
        paths: {
          '/pet/findByStatus': {
            get: {
              operationId: 'findPetsByStatus',
              parameters: [{ name: 'status', in: 'query', required: true }],
            },
          },
          '/pet/{petId}': {
            get: {
              operationId: 'getPetById',
              parameters: [{ name: 'petId', in: 'path', required: true }],
            },
          },
        },
      },
      { headers: JSON_TYPE },
    )
    .persist();
  const credentials = Buffer.from(
    'serverless-workflow:conformance-test',
  ).toString('base64');
  agent
    .get('https://httpbin.org')
    .intercept({
      path: '/basic-auth/serverless-workflow/conformance-test',
      method: 'GET',
      headers: { authorization: `Basic ${credentials}` },
    })
    .reply(
      200,
      { authenticated: true, user: 'serverless-workflow' },
      {
        headers: JSON_TYPE,
      },
    )
    .persist();
  return agent;
}

async function started(): Promise<TestApp> {
  if (app !== null) return app;

  const engineClock = new EngineClock(new ManualWorkflowClock());
  const agent = stubs();
  app = await createTestApp((builder) =>
    builder
      .overrideProvider(EndpointDispatcher)
      .useValue(agent)
      .overrideProvider(EngineClock)
      .useValue(engineClock),
  );
  return app;
}

// The kit's literals are YAML; the standard's SDK parses YAML as part of a document, so a
// literal is read as the value of a `set` in a throwaway document.
function yamlOf(text: string): unknown {
  const indented = text
    .split('\n')
    .map((line) => `            ${line}`)
    .join('\n');
  const document = [
    'document:',
    "  dsl: '1.0.3'",
    '  namespace: default',
    '  name: literal',
    "  version: '1.0.0'",
    'do:',
    '  - read:',
    '      set:',
    '        value:',
    indented,
  ].join('\n');
  const plain: unknown = Classes.Workflow.deserialize(document).asPlainObject();
  const workflow = plain as {
    do: { read: { set: { value: unknown } } }[];
  };
  return workflow.do[0]?.read.set.value;
}

function valueAt(source: unknown, path: string): unknown {
  let value: unknown = source;

  for (const key of path.split('.')) {
    if (typeof value !== 'object' || value === null) return undefined;

    value = (value as Record<string, unknown>)[key];
  }

  return value;
}

function executionOf(world: QuickPickleWorld): Execution {
  return world.data.execution as Execution;
}

function contradicted(world: QuickPickleWorld): boolean {
  return world.info.scenario === CONTRADICTION;
}

// In the recorded contradiction the platform faults with the error the kit expects in the
// output, so the output steps read that error instead.
function resultOf(world: QuickPickleWorld): unknown {
  const execution = executionOf(world);

  if (world.data.contradicted === true) return { error: execution.error };

  return execution.output;
}

// Every scenario begins with its definition, so this step also gives it a clean database.
Given('a workflow with definition:', async (world, definition: string) => {
  const t = await started();
  await truncateAll(t.db);
  await createUser(t, { email: 'ctk@example.com', role: Role.Editor });
  editor = authHeaders(await signIn(t.server, 'ctk@example.com'));
  world.data.input = {};
  world.data.definition = definition;
});

Given('given the workflow input is:', (world, input: string) => {
  world.data.input = yamlOf(input);
});

When('the workflow is executed', async (world) => {
  const t = await started();
  const definition = String(world.data.definition);
  // The kit writes YAML; the API reads JSON, so the SDK reads the YAML as the editor would.
  const document: unknown = Classes.Workflow.deserialize(definition, {
    validate: false,
  }).asPlainObject();
  const published = await request(t.server)
    .post('/api/v1/workflows')
    .set(editor)
    .send(document as object)
    .expect(201);
  const namespace = String(published.body.namespace);
  const name = String(published.body.name);
  const instance = await request(t.server)
    .post(`/api/v1/workflows/${namespace}/${name}/instances`)
    .set(editor)
    .send({ input: world.data.input })
    .expect(201);
  const id = String(instance.body.id);
  const worker = t.app.get(WorkflowWorker);

  for (let pass = 0; pass < 20; pass += 1) {
    const ran = await worker.drain();

    if (ran === 0) break;
  }

  const read = await request(t.server)
    .get(`/api/v1/instances/${id}`)
    .set(editor)
    .expect(200);
  const tasks = await request(t.server)
    .get(`/api/v1/instances/${id}/tasks?limit=500`)
    .set(editor)
    .expect(200);
  const execution: Execution = {
    phase: String(read.body.phase),
    output: read.body.output,
    error: read.body.error as Record<string, unknown> | null,
    tasks: (tasks.body.items as { name: string }[]).map((task) => task.name),
  };
  world.data.execution = execution;
});

Then('the workflow should complete', (world) => {
  const execution = executionOf(world);

  if (contradicted(world)) {
    expect(execution.phase).toBe('faulted');
    expect(execution.error).toMatchObject({
      type: 'https://serverlessworkflow.io/spec/1.0.0/errors/communication',
      status: 404,
    });
    world.data.contradicted = true;
    return;
  }

  expect(execution.phase, JSON.stringify(execution.error)).toBe('completed');
});

Then('the workflow should complete with output:', (world, output: string) => {
  const execution = executionOf(world);
  const expected = yamlOf(output);

  expect(execution.phase, JSON.stringify(execution.error)).toBe('completed');
  expect(execution.output).toEqual(expected);
});

Then('the workflow should fault', (world) => {
  expect(executionOf(world).phase).toBe('faulted');
});

Then('the workflow should fault with error:', (world, error: string) => {
  const execution = executionOf(world);
  const expected = yamlOf(error) as Record<string, unknown>;

  expect(execution.phase).toBe('faulted');
  expect(execution.error).toMatchObject(expected);
});

Then(
  /^the workflow output should have properties (.+)$/,
  (world, list: string) => {
    const names = list
      .split(',')
      .map((name) => name.trim().replaceAll("'", ''));
    const result = resultOf(world);

    for (const name of names) expect(valueAt(result, name), name).toBeDefined();
  },
);

Then(
  /^the workflow output should have a '([^']+)' property with value:$/,
  (world, name: string, value: string) => {
    const expected = yamlOf(value);
    const result = resultOf(world);

    expect(valueAt(result, name)).toEqual(expected);
  },
);

Then(
  /^the workflow output should have a '([^']+)' property containing (\d+) items$/,
  (world, name: string, count: string) => {
    const items = valueAt(executionOf(world).output, name);

    expect(Array.isArray(items) ? items.length : -1).toBe(Number(count));
  },
);

Then(/^(\w+) should run first$/, (world, task: string) => {
  expect(executionOf(world).tasks[0]).toBe(task);
});

Then(/^(\w+) should run last$/, (world, task: string) => {
  expect(executionOf(world).tasks.at(-1)).toBe(task);
});

Then(
  /^(\w+) should run after (\w+)$/,
  (world, later: string, earlier: string) => {
    const tasks = executionOf(world).tasks;
    const before = tasks.indexOf(earlier);

    expect(before, earlier).toBeGreaterThanOrEqual(0);
    expect(tasks.indexOf(later)).toBeGreaterThan(before);
  },
);
