import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Test } from '@nestjs/testing';
import { ResilienceService } from '@nestjs/resilience';
import type { INestApplicationContext } from '@nestjs/common';
import { ConfigModule } from '../../../src/frameworks/di/config.module.js';
import { ResilienceModule } from '../../../src/frameworks/di/resilience.module.js';
import { createEndpointDispatcher } from '../../../src/frameworks/undici/endpoint-dispatcher.js';
import { UndiciDeliveryClient } from '../../../src/frameworks/undici/undici-delivery.client.js';

// A delivery to a loopback address opens no connection unless the operator allow-lists it
// (FR-022, US6 AS8): the address is checked after DNS resolution, at connect time.
describe('a delivery and the outbound address policy', () => {
  let context: INestApplicationContext;
  let resilience: ResilienceService;
  let server: Server;
  let received = 0;
  let port = 0;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, ResilienceModule],
    }).compile();
    context = await moduleRef.init();
    resilience = context.get(ResilienceService);
    server = createServer((_request, response) => {
      received += 1;
      response.writeHead(202).end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve),
    );
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await context.close();
  });

  beforeEach(() => {
    received = 0;
  });

  const event = { specversion: '1.0', id: 'e-1', source: '/s', type: 't' };

  it('a_loopback_destination_is_refused_before_any_connection', async () => {
    const dispatcher = createEndpointDispatcher([]);
    const client = new UndiciDeliveryClient(dispatcher, resilience);

    const error = await client.post(
      `http://localhost:${String(port)}/events`,
      null,
      event,
    );

    expect(error).toMatch(/could not be reached/);
    expect(received).toBe(0);
    await dispatcher.close();
  });

  it('an_allow_listed_destination_takes_the_delivery', async () => {
    const dispatcher = createEndpointDispatcher(['127.0.0.1']);
    const client = new UndiciDeliveryClient(dispatcher, resilience);

    const error = await client.post(
      `http://127.0.0.1:${String(port)}/events`,
      null,
      event,
    );

    expect(error).toBeNull();
    expect(received).toBe(1);
    await dispatcher.close();
  });
});
