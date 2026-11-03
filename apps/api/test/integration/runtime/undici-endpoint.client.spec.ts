import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { ResilienceService } from '@nestjs/resilience';
import type { INestApplicationContext } from '@nestjs/common';
import { ConfigModule } from '../../../src/frameworks/di/config.module.js';
import { ResilienceModule } from '../../../src/frameworks/di/resilience.module.js';
import { EndpointOutcomeKind } from '../../../src/frameworks/runtime/enums.js';
import type { Exchange } from '../../../src/frameworks/runtime/interfaces.js';
import { createEndpointDispatcher } from '../../../src/frameworks/undici/endpoint-dispatcher.js';
import { UndiciEndpointClient } from '../../../src/frameworks/undici/undici-endpoint.client.js';

// A service call through the real dispatcher: the outbound address policy's refusal (FR-022),
// at connect time for an address and after resolution for a host name, and a refused connection
// each reach the author as their own reason.
describe('a service call and the connection it could not open', () => {
  let context: INestApplicationContext;
  let resilience: ResilienceService;
  let closedPort = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, ResilienceModule],
    }).compile();
    context = await moduleRef.init();
    resilience = context.get(ResilienceService);
    const server = createServer();
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    closedPort = (server.address() as AddressInfo).port;
    await new Promise((resolve) => server.close(resolve));
  });

  afterAll(async () => {
    await context.close();
  });

  function exchangeOf(host: string): Exchange {
    const url = `http://${host}:${String(closedPort)}/a`;
    return {
      request: { method: 'GET', url, headers: {}, body: null },
      authorization: null,
      timeout: null,
    };
  }

  const REFUSED_ADDRESS =
    'The address is private, loopback or link-local and not allow-listed';

  it.each(['127.0.0.1', 'localhost'])(
    'a_loopback_destination_%s_is_refused_with_the_policy_s_reason',
    async (host) => {
      const dispatcher = createEndpointDispatcher([]);
      const client = new UndiciEndpointClient(dispatcher, resilience);
      const exchange = exchangeOf(host);

      const outcome = await client.exchange(exchange);

      expect(outcome).toEqual({
        kind: EndpointOutcomeKind.Unreachable,
        reason: REFUSED_ADDRESS,
      });
      await dispatcher.close();
    },
  );

  it('an_allow_listed_port_nobody_listens_on_refuses_the_connection', async () => {
    const dispatcher = createEndpointDispatcher(['127.0.0.1']);
    const client = new UndiciEndpointClient(dispatcher, resilience);
    const exchange = exchangeOf('127.0.0.1');

    const outcome = await client.exchange(exchange);

    expect(outcome).toEqual({
      kind: EndpointOutcomeKind.Unreachable,
      reason: 'The service refused the connection',
    });
    await dispatcher.close();
  });
});
