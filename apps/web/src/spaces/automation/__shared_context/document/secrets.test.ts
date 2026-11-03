import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/libs/data-access/types';
import { secretsUsed, withDeclaredSecrets } from './secrets';

const calling = (secret: string): JsonObject => ({
  do: [
    {
      fetch: {
        call: 'http',
        with: {
          method: 'get',
          endpoint: {
            uri: 'https://crm.example.com',
            authentication: { bearer: { use: secret } },
          },
        },
      },
    },
  ],
});

describe('the secrets a draft uses', () => {
  it('are_found_in_the_authentication_of_its_calls', () => {
    expect(secretsUsed(calling('crm'))).toEqual(['crm']);
  });

  it('are_declared_in_use_secrets_once', () => {
    const declared = withDeclaredSecrets({
      ...calling('crm'),
      use: { secrets: ['other'] },
    });

    expect(declared.use).toEqual({ secrets: ['other', 'crm'] });
    expect(withDeclaredSecrets(declared)).toBe(declared);
  });
});
