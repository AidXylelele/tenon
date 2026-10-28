import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { interceptors, request } from 'undici';
import { createEndpointDispatcher } from '../../../src/frameworks/undici/endpoint-dispatcher.js';

interface Receiver {
  readonly server: Server;
  readonly port: number;
  connections: number;
}

async function startReceiver(redirectTo?: string): Promise<Receiver> {
  const server = createServer((_, response) => {
    if (redirectTo) {
      response.writeHead(302, { location: redirectTo }).end();
      return;
    }

    response.writeHead(200, { 'content-type': 'text/plain' }).end('reached');
  });
  const receiver = { server, port: 0, connections: 0 };
  server.on('connection', () => {
    receiver.connections += 1;
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  receiver.port = address.port;
  return receiver;
}

describe('endpoint dispatcher', () => {
  let receiver: Receiver;

  beforeAll(async () => {
    receiver = await startReceiver();
  });

  afterAll(() => {
    receiver.server.close();
  });

  it.each([
    'http://127.0.0.1',
    'http://localhost',
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'http://0.0.0.0',
    'http://10.1.2.3',
    'http://172.16.0.1',
    'http://192.168.1.1',
    'http://169.254.169.254',
    'http://[fe80::1]',
    'http://[fd00::1]',
  ])('a_call_to_%s_is_refused_before_a_connection_opens', async (origin) => {
    const dispatcher = createEndpointDispatcher([]);
    const before = receiver.connections;
    const url = `${origin}:${String(receiver.port)}/`;
    const call = request(url, { dispatcher });

    await expect(call).rejects.toMatchObject({ code: 'ERR_ADDRESS_REFUSED' });
    expect(receiver.connections).toBe(before);
  });

  it('an_allow_listed_address_is_reached', async () => {
    const dispatcher = createEndpointDispatcher(['127.0.0.0/8']);
    const url = `http://127.0.0.1:${String(receiver.port)}/`;
    const response = await request(url, { dispatcher });
    const body = await response.body.text();

    expect(response.statusCode).toBe(200);
    expect(body).toBe('reached');
  });

  it('a_redirect_to_a_refused_address_is_refused_at_the_hop', async () => {
    const target = `http://10.1.2.3:${String(receiver.port)}/`;
    const redirecting = await startReceiver(target);
    const redirects = interceptors.redirect({ maxRedirections: 3 });
    const dispatcher = createEndpointDispatcher(['127.0.0.1']).compose(
      redirects,
    );
    const url = `http://127.0.0.1:${String(redirecting.port)}/`;
    const call = request(url, { dispatcher });

    await expect(call).rejects.toMatchObject({ code: 'ERR_ADDRESS_REFUSED' });
    expect(redirecting.connections).toBe(1);
    redirecting.server.close();
  });
});
