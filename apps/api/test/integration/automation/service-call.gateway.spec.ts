import { Test } from '@nestjs/testing';
import { ResilienceService } from '@nestjs/resilience';
import { MockAgent } from 'undici';
import {
  AuthenticationScheme,
  CallKind,
} from '../../../src/domain/automation/language/enums.js';
import type { ServiceCall } from '../../../src/domain/automation/language/interfaces.js';
import { JsonPointer } from '../../../src/domain/automation/language/json-pointer.js';
import { CallOutput } from '../../../src/domain/automation/language/call-output.js';
import { OutputFormat } from '../../../src/domain/automation/language/output-format.js';
import { ServiceTimedOut } from '../../../src/domain/automation/language/results/service-timed-out.js';
import { ServiceResponded } from '../../../src/domain/automation/language/results/service-responded.js';
import { ResilienceModule } from '../../../src/frameworks/di/resilience.module.js';
import type { EndpointDispatcher } from '../../../src/frameworks/undici/endpoint-dispatcher.js';
import { UndiciEndpointClient } from '../../../src/frameworks/undici/undici-endpoint.client.js';
import { SystemClock } from '../../support/instance-fakes.js';
import { ServiceCallGateway } from '../../../src/interface-adapters/workflows/services/service-call.gateway.js';

const at = JsonPointer.root().at('do').at(0).at('getPet');
const content = new CallOutput(OutputFormat.Content, false);
const json = { headers: { 'content-type': 'application/json' } };

function httpCall(overrides: Partial<ServiceCall> = {}): ServiceCall {
  return {
    id: 'task-1:call',
    kind: CallKind.Http,
    endpoint: {
      uri: 'https://petstore.example/v2/pet/{petId}',
      authentication: null,
    },
    arguments: { method: 'get' },
    authentication: null,
    input: { petId: 1 },
    deadline: null,
    ...overrides,
  };
}

describe('ServiceCallGateway', () => {
  let agent: MockAgent;
  let caller: ServiceCallGateway;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule],
    }).compile();
    const resilience = moduleRef.get(ResilienceService);
    agent = new MockAgent();
    agent.disableNetConnect();
    const dispatcher = agent as unknown as EndpointDispatcher;
    const client = new UndiciEndpointClient(dispatcher, resilience);
    const clock = new SystemClock();
    caller = new ServiceCallGateway(client, clock);
  });

  afterAll(async () => {
    await agent.close();
  });

  it('a_call_expands_its_uri_template_from_the_input_and_reads_json_content', async () => {
    agent
      .get('https://petstore.example')
      .intercept({ path: '/v2/pet/1', method: 'GET' })
      .reply(200, { id: 1, name: 'Rex' }, json);

    const result = await caller.call(httpCall());

    expect(result).toBeInstanceOf(ServiceResponded);
    const outcome = result?.outcome(content, at);
    expect(outcome?.output).toEqual({ id: 1, name: 'Rex' });
  });

  it('a_response_output_describes_the_request_headers_and_status', async () => {
    agent
      .get('https://petstore.example')
      .intercept({ path: '/v2/pet/1?verbose=true', method: 'GET' })
      .reply(200, { id: 1 }, json);
    const call = httpCall({
      arguments: { method: 'get', query: { verbose: true } },
    });
    const response = new CallOutput(OutputFormat.Response, false);

    const result = await caller.call(call);

    expect(result?.outcome(response, at).output).toEqual({
      request: {
        method: 'GET',
        uri: 'https://petstore.example/v2/pet/1?verbose=true',
        headers: {},
      },
      headers: { 'content-type': 'application/json' },
      statusCode: 200,
      content: { id: 1 },
    });
  });

  it('basic_authentication_sends_its_credentials_and_describes_the_authorization', async () => {
    const expected = Buffer.from('rex:secret').toString('base64');
    agent
      .get('https://petstore.example')
      .intercept({
        path: '/v2/pet/1',
        method: 'GET',
        headers: { authorization: `Basic ${expected}` },
      })
      .reply(200, {}, json);
    const call = httpCall({
      endpoint: {
        uri: 'https://petstore.example/v2/pet/{petId}',
        authentication: {
          scheme: AuthenticationScheme.Basic,
          settings: { username: 'rex', password: 'secret' },
        },
      },
    });

    const response = new CallOutput(OutputFormat.Response, false);

    const result = await caller.call(call);

    expect(result?.outcome(content, at).authorization).toEqual({
      scheme: 'Basic',
      parameter: expected,
    });
    expect(result?.outcome(response, at).output).toMatchObject({
      request: { headers: { authorization: 'Basic [redacted]' } },
    });
  });

  it('client_credentials_get_a_token_and_call_with_it_as_a_bearer', async () => {
    const authority = agent.get('https://auth.example');
    authority
      .intercept({
        path: '/oauth2/token',
        method: 'POST',
        body: (body) =>
          body.includes('grant_type=client_credentials') &&
          body.includes('client_id=platform') &&
          body.includes('scope=pets.read'),
      })
      .reply(200, { access_token: 'token-1', token_type: 'Bearer' }, json);
    agent
      .get('https://petstore.example')
      .intercept({
        path: '/v2/pet/1',
        method: 'GET',
        headers: { authorization: 'Bearer token-1' },
      })
      .reply(200, { id: 1 }, json);
    const call = httpCall({
      endpoint: {
        uri: 'https://petstore.example/v2/pet/{petId}',
        authentication: {
          scheme: AuthenticationScheme.OAuth2,
          settings: {
            authority: 'https://auth.example',
            grant: 'client_credentials',
            client: { id: 'platform', secret: 'secret' },
            scopes: ['pets.read'],
          },
        },
      },
    });

    const result = await caller.call(call);

    expect(result?.outcome(content, at).output).toEqual({ id: 1 });
  });

  it('a_refused_token_request_fails_the_call_with_an_authentication_error', async () => {
    agent
      .get('https://auth.example')
      .intercept({ path: '/oauth2/token', method: 'POST' })
      .reply(401, { error: 'invalid_client' }, json);
    const call = httpCall({
      endpoint: {
        uri: 'https://petstore.example/v2/pet/{petId}',
        authentication: {
          scheme: AuthenticationScheme.OAuth2,
          settings: {
            authority: 'https://auth.example',
            client: { id: 'platform', secret: 'wrong' },
          },
        },
      },
    });

    const result = await caller.call(call);

    expect(result?.outcome(content, at).failure?.status).toBe(401);
  });

  it('an_operation_of_a_swagger_document_is_called_with_its_parameters', async () => {
    const swagger = {
      swagger: '2.0',
      host: 'petstore.example',
      basePath: '/v2',
      schemes: ['https'],
      paths: {
        '/pet/{petId}': {
          get: {
            operationId: 'getPetById',
            parameters: [
              { name: 'petId', in: 'path', required: true, type: 'integer' },
            ],
          },
        },
      },
    };
    agent
      .get('https://docs.example')
      .intercept({ path: '/swagger.json', method: 'GET' })
      .reply(200, swagger, json);
    agent
      .get('https://petstore.example')
      .intercept({ path: '/v2/pet/7', method: 'GET' })
      .reply(200, { id: 7 }, json);
    const call = httpCall({
      kind: CallKind.OpenApi,
      endpoint: {
        uri: 'https://docs.example/swagger.json',
        authentication: null,
      },
      arguments: { operationId: 'getPetById', parameters: { petId: 7 } },
    });

    const result = await caller.call(call);

    expect(result?.outcome(content, at).output).toEqual({ id: 7 });
  });

  it('an_operation_missing_from_the_document_fails_with_a_configuration_error', async () => {
    agent
      .get('https://docs.example')
      .intercept({ path: '/empty.json', method: 'GET' })
      .reply(200, { swagger: '2.0', paths: {} }, json);
    const call = httpCall({
      kind: CallKind.OpenApi,
      endpoint: {
        uri: 'https://docs.example/empty.json',
        authentication: null,
      },
      arguments: { operationId: 'getPetById', parameters: {} },
    });

    const result = await caller.call(call);

    expect(result?.outcome(content, at).failure?.status).toBe(400);
  });

  it('a_transport_failure_fails_the_call_with_a_communication_error', async () => {
    agent
      .get('https://down.example')
      .intercept({ path: '/', method: 'GET' })
      .replyWithError(
        Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
      );
    const call = httpCall({
      endpoint: { uri: 'https://down.example/', authentication: null },
    });

    const result = await caller.call(call);

    expect(result?.outcome(content, at).failure?.title).toBe(
      'Communication Error',
    );
  });

  it('a_response_larger_than_one_mebibyte_fails_the_call', async () => {
    const large = 'x'.repeat(1024 * 1024 + 1);
    agent
      .get('https://big.example')
      .intercept({ path: '/', method: 'GET' })
      .reply(200, large);
    const call = httpCall({
      endpoint: { uri: 'https://big.example/', authentication: null },
    });

    const result = await caller.call(call);

    expect(result?.outcome(content, at).failure?.detail).toBe(
      'The response is larger than 1 MiB',
    );
  });

  it('a_raw_output_carries_the_body_as_base64', async () => {
    agent
      .get('https://files.example')
      .intercept({ path: '/logo', method: 'GET' })
      .reply(200, Buffer.from([0, 1, 2]));
    const call = httpCall({
      endpoint: { uri: 'https://files.example/logo', authentication: null },
      arguments: { method: 'get', output: 'raw' },
    });
    const raw = new CallOutput(OutputFormat.Raw, false);

    const result = await caller.call(call);

    expect(result?.outcome(raw, at).output).toBe('AAEC');
  });

  it('a_call_stops_at_its_task_deadline_and_times_out', async () => {
    agent
      .get('https://petstore.example')
      .intercept({ path: '/v2/pet/1', method: 'GET' })
      .reply(200, { id: 1 }, json)
      .delay(2000);
    const deadline = new Date(Date.now() + 200);
    const call = httpCall({ deadline });
    const started = performance.now();

    const result = await caller.call(call);

    const elapsed = performance.now() - started;
    expect(result).toBeInstanceOf(ServiceTimedOut);
    expect(elapsed).toBeLessThan(1500);
  });

  it('a_call_whose_deadline_passed_is_not_sent', async () => {
    const deadline = new Date(Date.now() - 1);
    const call = httpCall({ deadline });

    const result = await caller.call(call);

    expect(result).toBeInstanceOf(ServiceTimedOut);
  });

  it.each([
    [
      'application/octet-stream',
      Buffer.from([0xff, 0xfe, 0x41, 0x00]),
      '//5BAA==',
    ],
    ['image/png', Buffer.from([0x89, 0x50]), 'iVA='],
    ['text/plain; charset=utf-8', Buffer.from('hello'), 'hello'],
    ['application/problem+json', Buffer.from('{"title":"x"}'), { title: 'x' }],
  ])(
    'content_of_type_%s_is_deserialized_or_base64',
    async (type, bytes, expected) => {
      agent
        .get('https://petstore.example')
        .intercept({ path: '/v2/pet/1', method: 'GET' })
        .reply(200, bytes, { headers: { 'content-type': type } });

      const result = await caller.call(httpCall());

      expect(result?.outcome(content, at).output).toEqual(expected);
    },
  );

  it('a_body_that_claims_json_and_is_not_is_a_communication_error', async () => {
    agent
      .get('https://petstore.example')
      .intercept({ path: '/v2/pet/1', method: 'GET' })
      .reply(200, '{not json', json);

    const result = await caller.call(httpCall());

    expect(result?.outcome(content, at).failure?.type).toBe(
      'https://serverlessworkflow.io/spec/1.0.0/errors/communication',
    );
  });

  it('content_holding_a_nul_character_is_a_communication_error', async () => {
    agent
      .get('https://petstore.example')
      .intercept({ path: '/v2/pet/1', method: 'GET' })
      .reply(200, 'a\u0000b', { headers: { 'content-type': 'text/plain' } });

    const result = await caller.call(httpCall());

    expect(result?.outcome(content, at).failure?.detail).toBe(
      'The response content holds a NUL character, which a value cannot hold',
    );
  });
});
