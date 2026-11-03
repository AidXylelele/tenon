import type {
  JsonObject,
  JsonValue,
} from '../../../src/domain/automation/json.js';
import { RunOutcomeKind } from '../../../src/interface-adapters/workflows/enums.js';
import type { RunOutcome } from '../../../src/interface-adapters/workflows/interfaces.js';
import {
  ERRORS,
  JSON_HEADERS,
  RuntimeHarness,
  aWorkflow,
} from '../../support/runtime-harness.js';

let h: RuntimeHarness;

beforeAll(async () => {
  h = await RuntimeHarness.start();
});

afterAll(async () => {
  await h.close();
});

function outputOf(outcome: RunOutcome): unknown {
  if (outcome.kind !== RunOutcomeKind.Completed)
    throw new Error(`the run did not complete: ${JSON.stringify(outcome)}`);

  return outcome.output;
}

function errorOf(outcome: RunOutcome): JsonObject {
  if (outcome.kind !== RunOutcomeKind.Faulted)
    throw new Error(`the run did not fault: ${JSON.stringify(outcome)}`);

  return outcome.error;
}

interface Received {
  readonly method: string;
  readonly path: string;
  readonly headers: Record<string, string>;
  readonly body: string | null;
}

interface Reply {
  readonly status?: number;
  readonly data?: JsonValue | Buffer | string;
  readonly headers?: Record<string, string>;
}

function headersOf(raw: unknown): Record<string, string> {
  const headers: Record<string, string> = {};

  if (raw === undefined || raw === null) return headers;

  if (Array.isArray(raw)) {
    for (let index = 0; index < raw.length; index += 2)
      headers[String(raw[index]).toLowerCase()] = String(raw[index + 1]);

    return headers;
  }

  for (const [name, value] of Object.entries(raw as Record<string, unknown>))
    headers[name.toLowerCase()] = String(value);

  return headers;
}

function textOf(body: unknown): string | null {
  if (body === undefined || body === null) return null;

  if (typeof body === 'string') return body;

  if (Buffer.isBuffer(body)) return body.toString('utf8');

  return JSON.stringify(body);
}

// Every request to the origin is recorded and answered with the reply.
function serve(origin: string, reply: Reply = {}): Received[] {
  const received: Received[] = [];
  h.agent
    .get(origin)
    .intercept({ path: () => true, method: () => true })
    .reply((options) => {
      const body = textOf(options.body);
      received.push({
        method: options.method,
        path: options.path,
        headers: headersOf(options.headers),
        body,
      });
      const data = reply.data ?? { ok: true };
      const payload =
        typeof data === 'string' || Buffer.isBuffer(data)
          ? data
          : JSON.stringify(data);
      return {
        statusCode: reply.status ?? 200,
        data: payload,
        responseOptions: { headers: reply.headers ?? JSON_HEADERS },
      };
    })
    .persist();
  return received;
}

function http(withs: JsonObject, rest: JsonObject = {}): JsonObject {
  return { call: 'http', with: withs, ...rest };
}

describe('the request an HTTP call sends', () => {
  it('fills_the_uri_template_from_the_input_s_top_level_values', async () => {
    const received = serve('https://uri-template.test');
    const document = aWorkflow([
      {
        getPet: http({
          method: 'get',
          endpoint: 'https://uri-template.test/pets/{petId}/{flag}',
        }),
      },
    ]);

    await h.run(document, { petId: 42, flag: true });

    expect(received[0]).toMatchObject({ method: 'GET', path: '/pets/42/true' });
  });

  it('encodes_values_and_leaves_a_missing_one_empty', async () => {
    const received = serve('https://uri-encoded.test');
    const document = aWorkflow([
      {
        getPet: http({
          method: 'get',
          endpoint: { uri: 'https://uri-encoded.test/a/{q}/x{missing}' },
        }),
      },
    ]);

    await h.run(document, { q: 'a b/c' });

    expect(received[0]?.path).toBe('/a/a%20b%2Fc/x');
  });

  it('the_runtime_takes_a_dotted_name_verbatim', async () => {
    const received = serve('https://uri-verbatim.test');
    const document = aWorkflow([
      {
        getPet: http({
          method: 'get',
          endpoint: 'https://uri-verbatim.test/a/{pet.id}',
        }),
      },
    ]);

    await h.run(
      document,
      { 'pet.id': 'p1', pet: { id: 'wrong' } },
      {
        unchecked: true,
      },
    );

    expect(received[0]?.path).toBe('/a/p1');
  });

  // "URI Template": "`{pet.id}` will be replaced with the value of the "pet.id" property"; RFC 6570
  // allows dots in a variable name, so the publish checks accept the endpoint.
  it('publish_accepts_the_dotted_uri_template_variable_the_standard_describes', async () => {
    const document = aWorkflow([
      {
        getPet: http({
          method: 'get',
          endpoint: 'https://uri-verbatim.test/a/{pet.id}',
        }),
      },
    ]);

    expect(await h.problemOf(document)).toBeNull();
  });

  it('evaluates_an_endpoint_written_as_an_expression', async () => {
    const received = serve('https://uri-expression.test');
    const document = aWorkflow([
      {
        getPet: http({
          method: 'get',
          endpoint:
            '${ "https://uri-expression.test/pets/" + (.id | tostring) }',
        }),
      },
    ]);

    await h.run(document, { id: 5 });

    expect(received[0]?.path).toBe('/pets/5');
  });

  // "URI Template": "The referenced variable must be of type string, number, boolean, or null. If
  // the variable is of a different type an error with type .../errors/expression and status 400
  // will be raised."
  it('an_object_in_a_uri_template_raises_an_expression_error', async () => {
    const received = serve('https://uri-object.test');
    const document = aWorkflow([
      {
        getPet: http({
          method: 'get',
          endpoint: 'https://uri-object.test/pets/{petId}',
        }),
      },
    ]);

    const { outcome } = await h.run(document, { petId: { id: 1 } });

    expect(received).toHaveLength(0);
    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}expression`,
      status: 400,
    });
  });

  it('sends_the_query_and_headers_with_their_expressions_evaluated', async () => {
    const received = serve('https://query.test');
    const document = aWorkflow([
      {
        find: http({
          method: 'get',
          endpoint: 'https://query.test/pets',
          query: { status: 'available', limit: '${ .n }' },
          headers: { 'X-Trace': '${ .trace }', Accept: 'application/json' },
        }),
      },
    ]);

    await h.run(document, { n: 5, trace: 't-1' });

    expect(received[0]?.path).toBe('/pets?status=available&limit=5');
    expect(received[0]?.headers).toMatchObject({
      'x-trace': 't-1',
      accept: 'application/json',
    });
  });

  it('sends_an_object_body_as_json_and_a_text_body_as_is', async () => {
    const received = serve('https://body.test');
    const document = aWorkflow([
      {
        asJson: http({
          method: 'post',
          endpoint: 'https://body.test/json',
          body: { name: '${ .name }', tags: ['a'] },
        }),
      },
      {
        asText: http({
          method: 'put',
          endpoint: 'https://body.test/text',
          headers: { 'content-type': 'text/plain' },
          body: 'plain words',
        }),
      },
    ]);

    await h.run(document, { name: 'Milou' });

    expect(received[0]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(String(received[0]?.body))).toEqual({
      name: 'Milou',
      tags: ['a'],
    });
    expect(received[0]?.headers['content-type']).toBe('application/json');
    expect(received[1]).toMatchObject({ method: 'PUT', body: 'plain words' });
    expect(received[1]?.headers['content-type']).toBe('text/plain');
  });
});

describe('what an HTTP call outputs', () => {
  it('outputs_the_parsed_json_content_by_default', async () => {
    serve('https://content.test', { data: { id: 1, name: 'milou' } });
    const document = aWorkflow([
      {
        getPet: http({
          method: 'get',
          endpoint: 'https://content.test/pets/1',
        }),
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ id: 1, name: 'milou' });
  });

  it('outputs_text_content_as_text_binary_content_in_base64_and_an_empty_body_as_null', async () => {
    serve('https://text.test', {
      data: 'hello',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
    serve('https://binary.test', {
      data: Buffer.from([0, 1, 2, 255]),
      headers: { 'content-type': 'application/octet-stream' },
    });
    serve('https://empty.test', { status: 204, data: '' });
    const document = aWorkflow([
      {
        all: {
          fork: {
            branches: [
              { text: http({ method: 'get', endpoint: 'https://text.test/' }) },
              {
                binary: http({
                  method: 'get',
                  endpoint: 'https://binary.test/',
                }),
              },
              {
                empty: http({ method: 'get', endpoint: 'https://empty.test/' }),
              },
            ],
          },
        },
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual(['hello', 'AAEC/w==', null]);
  });

  it('outputs_the_whole_response_with_credentials_redacted', async () => {
    serve('https://response.test', {
      data: { id: 1 },
      headers: { 'content-type': 'application/json', 'x-rate': '9' },
    });
    const document = aWorkflow([
      {
        getPet: http({
          method: 'get',
          endpoint: {
            uri: 'https://response.test/pets/1',
            authentication: { bearer: { token: 'secret-token' } },
          },
          output: 'response',
        }),
      },
    ]);

    const { outcome } = await h.run(document, {});

    const response = outputOf(outcome) as JsonObject;
    expect(response).toMatchObject({
      statusCode: 200,
      content: { id: 1 },
      headers: { 'x-rate': '9' },
      request: {
        uri: 'https://response.test/pets/1',
        headers: { authorization: 'Bearer [redacted]' },
      },
    });
    const method = (response.request as JsonObject).method as string;
    expect(method.toLowerCase()).toBe('get');
    expect(JSON.stringify(response)).not.toContain('secret-token');
  });

  it('outputs_the_raw_body_in_base64', async () => {
    serve('https://raw.test', { data: { id: 1 } });
    const document = aWorkflow([
      {
        getPet: http({
          method: 'get',
          endpoint: 'https://raw.test/pets/1',
          output: 'raw',
        }),
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toBe(
      Buffer.from(JSON.stringify({ id: 1 })).toString('base64'),
    );
  });

  it.each([400, 404, 500, 503])(
    'a_%i_faults_with_a_communication_error_with_that_status',
    async (status) => {
      serve(`https://status-${String(status)}.test`, {
        status,
        data: { e: 1 },
      });
      const document = aWorkflow([
        {
          getPet: http({
            method: 'get',
            endpoint: `https://status-${String(status)}.test/pets/1`,
          }),
        },
      ]);

      const { outcome } = await h.run(document, {});

      expect(errorOf(outcome)).toMatchObject({
        type: `${ERRORS}communication`,
        status,
        instance: '/do/0/getPet',
      });
    },
  );

  it('a_redirection_is_an_error_unless_redirect_is_true', async () => {
    serve('https://redirect.test', {
      status: 302,
      data: { moved: true },
      headers: { 'content-type': 'application/json', location: '/elsewhere' },
    });
    const refused = aWorkflow([
      { go: http({ method: 'get', endpoint: 'https://redirect.test/a' }) },
    ]);
    const accepted = aWorkflow([
      {
        go: http({
          method: 'get',
          endpoint: 'https://redirect.test/a',
          redirect: true,
          output: 'response',
        }),
      },
    ]);

    const first = await h.run(refused, {});
    const second = await h.run(accepted, {});

    expect(errorOf(first.outcome)).toMatchObject({
      type: `${ERRORS}communication`,
      status: 302,
    });
    expect(outputOf(second.outcome)).toMatchObject({ statusCode: 302 });
  });

  it('redirect_true_still_faults_on_a_status_from_400', async () => {
    serve('https://redirect-404.test', { status: 404 });
    const document = aWorkflow([
      {
        go: http({
          method: 'get',
          endpoint: 'https://redirect-404.test/a',
          redirect: true,
        }),
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({ status: 404 });
  });

  it('a_json_response_that_does_not_parse_faults_with_a_communication_error', async () => {
    serve('https://bad-json.test', { data: '{"broken":' });
    const document = aWorkflow([
      { go: http({ method: 'get', endpoint: 'https://bad-json.test/a' }) },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}communication`,
      instance: '/do/0/go',
    });
  });

  it('an_unreachable_service_faults_with_a_communication_error', async () => {
    const document = aWorkflow([
      {
        go: http({ method: 'get', endpoint: 'https://nobody-listens.test/a' }),
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}communication`,
      status: 500,
    });
  });
});

describe('authentication', () => {
  it('basic_sends_the_base64_of_user_and_password', async () => {
    const received = serve('https://basic.test');
    const document = aWorkflow([
      {
        go: http({
          method: 'get',
          endpoint: {
            uri: 'https://basic.test/secure',
            authentication: {
              basic: { username: 'serverless-workflow', password: '${ .pw }' },
            },
          },
        }),
      },
    ]);

    await h.run(document, { pw: 'conformance-test' });

    const expected = Buffer.from(
      'serverless-workflow:conformance-test',
    ).toString('base64');
    expect(received[0]?.headers.authorization).toBe(`Basic ${expected}`);
  });

  it('bearer_sends_the_token_and_a_policy_is_used_by_name', async () => {
    const received = serve('https://bearer.test');
    const document = aWorkflow(
      [
        {
          go: http({
            method: 'get',
            endpoint: {
              uri: 'https://bearer.test/secure',
              authentication: { use: 'userToken' },
            },
          }),
        },
      ],
      {
        use: {
          authentications: {
            userToken: { bearer: { token: '${ .user.token }' } },
          },
        },
      },
    );

    await h.run(document, { user: { token: 'abc123' } });

    expect(received[0]?.headers.authorization).toBe('Bearer abc123');
  });

  // "Runtime expression arguments": `$authorization` "Describes the resolved authorization, as
  // defined by the task's authentication, if any", available to the task's `output.as`.
  it('the_authorization_argument_is_bound_for_the_call_s_definition', async () => {
    const received = serve('https://authorization-definition.test');
    const document = aWorkflow([
      {
        go: http({
          method: 'get',
          endpoint: {
            uri: 'https://authorization-definition.test/secure',
            authentication: { bearer: { token: 'abc123' } },
          },
          headers: { 'X-Scheme': '${ $authorization.scheme }' },
        }),
      },
    ]);

    await h.run(document, {});

    expect(received[0]?.headers['x-scheme']).toBe('Bearer');
  });

  it('the_authorization_argument_is_bound_for_output_as', async () => {
    serve('https://authorization-arg.test');
    const document = aWorkflow([
      {
        go: http(
          {
            method: 'get',
            endpoint: {
              uri: 'https://authorization-arg.test/secure',
              authentication: { bearer: { token: 'abc123' } },
            },
          },
          { output: { as: '${ { scheme: $authorization.scheme } }' } },
        ),
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(outputOf(outcome)).toEqual({ scheme: 'Bearer' });
  });
});

describe('openapi', () => {
  const swagger = {
    swagger: '2.0',
    host: 'petstore2.test',
    basePath: '/v2',
    schemes: ['https'],
    paths: {
      '/pet/{petId}': {
        parameters: [
          { name: 'petId', in: 'path', required: true, type: 'integer' },
        ],
        get: {
          operationId: 'getPetById',
          parameters: [
            { name: 'api_key', in: 'header', required: false, type: 'string' },
            { name: 'verbose', in: 'query', required: false, type: 'boolean' },
          ],
        },
      },
      '/pet/findByStatus': {
        get: {
          operationId: 'findPetsByStatus',
          parameters: [
            { name: 'status', in: 'query', required: true, type: 'string' },
          ],
        },
      },
      '/pet': {
        post: {
          operationId: 'addPet',
          parameters: [
            {
              name: 'body',
              in: 'body',
              required: true,
              schema: { type: 'object' },
            },
          ],
        },
      },
    },
  };

  function served(origin: string, document: JsonObject): Received[] {
    const received: Received[] = [];
    const pool = h.agent.get(origin);
    pool
      .intercept({ path: '/doc.json', method: 'GET' })
      .reply(200, JSON.stringify(document), { headers: JSON_HEADERS })
      .persist();
    pool
      .intercept({ path: (path) => path !== '/doc.json', method: () => true })
      .reply((options) => {
        received.push({
          method: options.method,
          path: options.path,
          headers: headersOf(options.headers),
          body: textOf(options.body),
        });
        return {
          statusCode: 200,
          data: JSON.stringify({ called: options.path }),
          responseOptions: { headers: JSON_HEADERS },
        };
      })
      .persist();
    return received;
  }

  function openapi(
    origin: string,
    operationId: string,
    parameters: JsonObject = {},
    rest: JsonObject = {},
  ): JsonObject {
    return {
      call: 'openapi',
      with: {
        document: { endpoint: `${origin}/doc.json` },
        operationId,
        parameters,
        ...rest,
      },
    };
  }

  it('swagger_2_places_path_query_and_header_parameters_on_host_and_base_path', async () => {
    const received = served('https://petstore2.test', swagger);
    const document = aWorkflow([
      {
        getPet: openapi('https://petstore2.test', 'getPetById', {
          petId: '${ .id }',
          api_key: 'k-1',
          verbose: true,
        }),
      },
    ]);

    const { outcome } = await h.run(document, { id: 3 });

    expect(outputOf(outcome)).toEqual({ called: '/v2/pet/3?verbose=true' });
    expect(received[0]?.method).toBe('GET');
    expect(received[0]?.headers.api_key).toBe('k-1');
  });

  it('swagger_2_sends_a_body_parameter_as_json', async () => {
    const received = served('https://petstore2-body.test', {
      ...swagger,
      host: 'petstore2-body.test',
    });
    const document = aWorkflow([
      {
        add: openapi('https://petstore2-body.test', 'addPet', {
          body: { name: '${ .name }' },
        }),
      },
    ]);

    await h.run(document, { name: 'Milou' });

    expect(received[0]).toMatchObject({ method: 'POST', path: '/v2/pet' });
    expect(JSON.parse(String(received[0]?.body))).toEqual({ name: 'Milou' });
  });

  it('openapi_3_uses_the_first_server_with_its_variables_and_a_request_body', async () => {
    const received = served('https://petstore3.test', {
      openapi: '3.0.3',
      info: { title: 'pets', version: '1' },
      servers: [
        {
          url: 'https://petstore3.test/{base}',
          variables: { base: { default: 'api/v3' } },
        },
      ],
      paths: {
        '/pet': {
          put: {
            operationId: 'updatePet',
            requestBody: {
              content: { 'application/json': { schema: { type: 'object' } } },
            },
          },
        },
      },
    });
    const document = aWorkflow([
      {
        update: openapi('https://petstore3.test', 'updatePet', {
          body: { id: 1 },
        }),
      },
    ]);

    await h.run(document, {});

    expect(received[0]).toMatchObject({ method: 'PUT', path: '/api/v3/pet' });
    expect(JSON.parse(String(received[0]?.body))).toEqual({ id: 1 });
  });

  it('openapi_3_resolves_a_relative_server_against_the_document_url', async () => {
    const received = served('https://petstore3-relative.test', {
      openapi: '3.0.3',
      info: { title: 'pets', version: '1' },
      servers: [{ url: '/api/v3' }],
      paths: {
        '/pet/findByStatus': {
          get: {
            operationId: 'findPetsByStatus',
            parameters: [{ name: 'status', in: 'query', required: true }],
          },
        },
      },
    });
    const document = aWorkflow([
      {
        find: openapi('https://petstore3-relative.test', 'findPetsByStatus', {
          status: 'available',
        }),
      },
    ]);

    await h.run(document, {});

    expect(received[0]?.path).toBe('/api/v3/pet/findByStatus?status=available');
  });

  it('a_missing_required_parameter_faults_with_a_configuration_error_before_any_call', async () => {
    const received = served('https://petstore2-missing.test', {
      ...swagger,
      host: 'petstore2-missing.test',
    });
    const document = aWorkflow([
      { find: openapi('https://petstore2-missing.test', 'findPetsByStatus') },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}configuration`,
      status: 400,
      instance: '/do/0/find',
    });
    expect(received).toHaveLength(0);
  });

  it('an_unknown_operation_faults_with_a_configuration_error', async () => {
    served('https://petstore2-unknown.test', {
      ...swagger,
      host: 'petstore2-unknown.test',
    });
    const document = aWorkflow([
      { find: openapi('https://petstore2-unknown.test', 'deleteEverything') },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}configuration`,
      status: 400,
    });
  });

  it('a_document_that_cannot_be_read_faults_with_a_communication_error', async () => {
    h.agent
      .get('https://no-document.test')
      .intercept({ path: '/doc.json', method: 'GET' })
      .reply(404, 'missing');
    const document = aWorkflow([
      {
        find: openapi('https://no-document.test', 'findPetsByStatus', {
          status: 'x',
        }),
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({ type: `${ERRORS}communication` });
  });

  it('an_operation_error_status_faults_with_that_status', async () => {
    const pool = h.agent.get('https://petstore2-error.test');
    pool
      .intercept({ path: '/doc.json', method: 'GET' })
      .reply(
        200,
        JSON.stringify({ ...swagger, host: 'petstore2-error.test' }),
        {
          headers: JSON_HEADERS,
        },
      );
    pool.intercept({ path: '/v2/pet/9', method: 'GET' }).reply(404, 'nope');
    const document = aWorkflow([
      {
        getPet: openapi('https://petstore2-error.test', 'getPetById', {
          petId: 9,
        }),
      },
    ]);

    const { outcome } = await h.run(document, {});

    expect(errorOf(outcome)).toMatchObject({
      type: `${ERRORS}communication`,
      status: 404,
      instance: '/do/0/getPet',
    });
  });
});
