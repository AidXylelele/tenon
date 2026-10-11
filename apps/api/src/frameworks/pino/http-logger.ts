import { randomUUID } from 'node:crypto';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import type { Params } from 'nestjs-pino';
import type { SerializedError } from 'pino';

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
    serializers: {
      err: (serialized: SerializedError) => {
        const error = serialized.raw;

        if (!(error instanceof DrizzleQueryError)) return serialized;

        const values = error.message.slice(
          `Failed query: ${error.query}`.length,
        );
        return {
          ...serialized,
          message: serialized.message.replace(values, ''),
          stack: serialized.stack.replace(values, ''),
          params: undefined,
        };
      },
    },
    autoLogging: {
      ignore: (request) => (request.url ?? '').startsWith('/api/v1/health'),
    },
    transport: pretty
      ? { target: 'pino-pretty', options: { singleLine: true } }
      : undefined,
  };
}
