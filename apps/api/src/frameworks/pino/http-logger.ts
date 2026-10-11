import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';

export function createHttpLoggerOptions(
  level: string,
  pretty: boolean,
): Params['pinoHttp'] {
  return {
    level,
    genReqId: (request, response) => {
      const incoming = request.headers['x-request-id'];
      const id =
        typeof incoming === 'string' && incoming.length > 0
          ? incoming
          : randomUUID();
      response.setHeader('x-request-id', id);
      return id;
    },
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        '*.password',
        '*.token',
        '*.newPassword',
        '*.currentPassword',
      ],
      censor: '[redacted]',
    },
    autoLogging: {
      ignore: (request) => (request.url ?? '').startsWith('/api/v1/health'),
    },
    transport: pretty
      ? { target: 'pino-pretty', options: { singleLine: true } }
      : undefined,
  };
}
