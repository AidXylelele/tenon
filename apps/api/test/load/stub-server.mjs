// A local HTTP service for the HTTP-call workflow: answers every request with a small JSON body,
// after `?delay=<ms>` when given. Counts requests and prints the count on SIGINT/SIGTERM.
//   node test/load/stub-server.mjs [port]      (default 18080, listens on 127.0.0.1)
import { createServer } from 'node:http';

const port = Number(process.argv[2] ?? process.env.STUB_PORT ?? 18080);
let served = 0;

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  const delay = Number(url.searchParams.get('delay') ?? 0);
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    served += 1;
    const body = JSON.stringify({
      ok: true,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      received: Buffer.concat(chunks).length,
      served,
    });
    const reply = () => {
      response.writeHead(200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      });
      response.end(body);
    };

    if (delay > 0) setTimeout(reply, delay);
    else reply();
  });
});

server.keepAliveTimeout = 30_000;
server.listen(port, '127.0.0.1', () => {
  console.log(`stub listening on http://127.0.0.1:${String(port)}`);
});

const stop = () => {
  console.log(`stub served ${String(served)} requests`);
  server.close(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
