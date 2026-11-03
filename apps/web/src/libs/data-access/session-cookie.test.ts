import { describe, expect, it } from 'vitest';
import { issuedSession, sessionCookieName } from './session-cookie';

describe('the session the API issues', () => {
  it('is_kept_as_its_name_and_token_with_its_lifetime', () => {
    const issued = issuedSession([
      'sid=abc.def; Max-Age=2592000; Path=/; HttpOnly; SameSite=Lax',
    ]);

    expect(issued).toEqual({ pair: 'sid=abc.def', maxAge: 2592000 });
  });

  it('a_cleared_cookie_ends_the_session', () => {
    expect(issuedSession(['sid=; Max-Age=0; Path=/'])?.maxAge).toBe(0);
  });

  it('a_response_without_a_session_cookie_issues_none', () => {
    expect(issuedSession(['other=1; Path=/'])).toBeNull();
    expect(issuedSession([])).toBeNull();
  });

  it('under_https_the_cookie_is_pinned_to_the_origin', () => {
    expect(sessionCookieName(true)).toBe('__Host-console_session');
    expect(sessionCookieName(false)).toBe('console_session');
  });
});
