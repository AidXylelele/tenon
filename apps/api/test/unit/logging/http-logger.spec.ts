import { DrizzleQueryError } from 'drizzle-orm/errors';
import { pinoHttp, type Options } from 'pino-http';
import { createHttpLoggerOptions } from '../../../src/frameworks/pino/http-logger.js';

describe('http logger', () => {
  const loggedRecord = (error: Error): string => {
    const lines: string[] = [];
    const { logger } = pinoHttp(
      createHttpLoggerOptions('error', false) as Options,
      {
        write: (line: string) => {
          lines.push(line);
        },
      },
    );
    logger.error({ err: error }, 'request failed');
    return lines.join('');
  };

  it('a_failed_query_is_logged_with_its_statement_and_cause_but_without_the_values_it_carried', () => {
    const record = loggedRecord(
      new DrizzleQueryError(
        'insert into "user" ("email", "password_hash") values ($1, $2)',
        ['someone@example.com', '$scrypt$ln=17,r=8,p=1$c2FsdA$aGFzaA'],
        new Error(
          'duplicate key value violates unique constraint "user_email_unique"',
        ),
      ),
    );
    expect(record).not.toContain('someone@example.com');
    expect(record).not.toContain('$scrypt$');
    expect(record).toContain('insert into \\"user\\"');
    expect(record).toContain('user_email_unique');
  });

  it('other_errors_keep_their_message', () => {
    const record = loggedRecord(
      new Error('the mail server refused the message'),
    );
    expect(record).toContain('the mail server refused the message');
  });
});
