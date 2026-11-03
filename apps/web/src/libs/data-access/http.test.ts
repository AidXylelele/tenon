import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  command,
  forgetSession,
  keepIssuedSession,
  read,
  send,
} from './http';
import { SIGN_IN_AGAIN_HEADER } from './session-cookie';

const cookieStore = { get: vi.fn(), set: vi.fn(), delete: vi.fn() };
const requestHeaders = new Headers();
const redirect = vi.fn((address: string) => {
  throw new Error(`NEXT_REDIRECT;${address}`);
});
const fetchApi = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(cookieStore),
  headers: () => Promise.resolve(requestHeaders),
}));
vi.mock('next/navigation', () => ({
  redirect: (address: string) => redirect(address),
}));

// An answer of the API with a JSON body, or none.
function answer(status: number, body?: unknown, headers?: HeadersInit) {
  const text = body === undefined ? null : JSON.stringify(body);
  return new Response(text, { status, headers });
}

// What the last request to the API was: its address and its options.
function lastRequest(): { url: URL; init: RequestInit } {
  const [url, init] = fetchApi.mock.lastCall as [URL, RequestInit];
  return { url, init };
}

describe('a request to the API', () => {
  beforeEach(() => {
    vi.stubEnv('API_URL', 'http://api.test');
    vi.stubEnv('SESSION_COOKIE_SECURE', 'false');
    vi.stubGlobal('fetch', fetchApi);
    fetchApi.mockReset();
    redirect.mockClear();
    cookieStore.get.mockReturnValue({ value: 'sid=abc' });
    cookieStore.set.mockClear();
    cookieStore.delete.mockClear();
    requestHeaders.set(SIGN_IN_AGAIN_HEADER, '/sign-in?reason=ended&next=%2F');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('forwards_the_session_and_sends_json_to_the_versioned_address', async () => {
    fetchApi.mockResolvedValue(answer(201, { id: 'run-1' }));

    await send('/workflows/sales/route-lead/instances', {
      method: 'POST',
      json: { input: {} },
      query: { version: 'latest', cursor: undefined, empty: '' },
    });
    const { url, init } = lastRequest();
    const headers = new Headers(init.headers);

    expect(url.href).toBe(
      'http://api.test/api/v1/workflows/sales/route-lead/instances?version=latest',
    );
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"input":{}}');
    expect(init.cache).toBe('no-store');
    expect(headers.get('cookie')).toBe('sid=abc');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('accept')).toBe(
      'application/json, application/problem+json',
    );
  });

  it('an_anonymous_call_sends_no_session_and_its_401_is_an_answer', async () => {
    fetchApi.mockResolvedValue(answer(401, { title: 'Invalid credentials' }));

    const response = await send('/auth/session', {
      method: 'POST',
      anonymous: true,
    });
    const headers = new Headers(lastRequest().init.headers);

    expect(response.status).toBe(401);
    expect(headers.has('cookie')).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('a_401_on_a_signed_in_call_signs_in_again_where_the_app_said', async () => {
    fetchApi.mockResolvedValue(answer(401));

    const sending = send('/workflows');

    await expect(sending).rejects.toThrow(
      'NEXT_REDIRECT;/sign-in?reason=ended&next=%2F',
    );
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it('a_401_without_an_address_to_sign_in_again_fails_as_unauthorized', async () => {
    requestHeaders.delete(SIGN_IN_AGAIN_HEADER);
    fetchApi.mockResolvedValue(answer(401));

    const sending = send('/workflows');

    await expect(sending).rejects.toMatchObject({ status: 401 });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('a_platform_that_does_not_answer_fails_with_what_to_do', async () => {
    fetchApi.mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED'));

    const sending = send('/workflows');

    await expect(sending).rejects.toEqual(
      new ApiError(503, 'The platform is not answering; try again in a moment'),
    );
  });

  it('a_text_body_carries_its_own_type', async () => {
    fetchApi.mockResolvedValue(answer(204));

    await send('/webhooks/hook-1', {
      method: 'POST',
      text: 'a,b',
      contentType: 'text/csv',
    });
    const { init } = lastRequest();
    const headers = new Headers(init.headers);

    expect(init.body).toBe('a,b');
    expect(headers.get('content-type')).toBe('text/csv');
  });
});

describe('a read', () => {
  beforeEach(() => {
    vi.stubEnv('API_URL', 'http://api.test');
    vi.stubGlobal('fetch', fetchApi);
    fetchApi.mockReset();
    cookieStore.get.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is_the_value_the_api_answered', async () => {
    fetchApi.mockResolvedValue(answer(200, { name: 'route-lead' }));

    const value = await read('/workflows/sales/route-lead');

    expect(value).toEqual({ name: 'route-lead' });
  });

  it('a_resource_that_does_not_exist_is_null', async () => {
    fetchApi.mockResolvedValue(answer(404, { title: 'Not found' }));

    const value = await read('/workflows/sales/gone');

    expect(value).toBeNull();
  });

  it('another_refusal_fails_with_its_detail', async () => {
    fetchApi.mockResolvedValue(
      answer(403, { title: 'Forbidden', detail: 'Only authors may read it' }),
    );

    const reading = read('/secrets');

    await expect(reading).rejects.toEqual(
      new ApiError(403, 'Only authors may read it'),
    );
  });

  it('an_answer_that_never_changes_is_kept_in_the_data_cache', async () => {
    fetchApi.mockResolvedValue(answer(200, {}));

    await read('/workflows/sales/route-lead/versions/1.0.0', {
      immutable: true,
    });

    expect(lastRequest().init.cache).toBe('force-cache');
  });

  it('without_a_session_none_is_sent', async () => {
    fetchApi.mockResolvedValue(answer(200, []));

    await read('/workflows');
    const headers = new Headers(lastRequest().init.headers);

    expect(headers.has('cookie')).toBe(false);
  });
});

describe('a command', () => {
  beforeEach(() => {
    vi.stubEnv('API_URL', 'http://api.test');
    vi.stubGlobal('fetch', fetchApi);
    fetchApi.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('is_its_value', async () => {
    fetchApi.mockResolvedValue(answer(201, { id: 'hook-1' }));

    const outcome = await command('/webhooks', { method: 'POST', json: {} });

    expect(outcome).toEqual({ ok: true, value: { id: 'hook-1' } });
  });

  it('an_empty_answer_has_no_value', async () => {
    fetchApi.mockResolvedValue(answer(204));

    const outcome = await command('/secrets/token', { method: 'DELETE' });

    expect(outcome).toEqual({ ok: true, value: undefined });
  });

  it('a_refusal_is_the_problem_the_api_stated', async () => {
    fetchApi.mockResolvedValue(
      answer(409, {
        type: 'urn:problem:workflow.archived',
        title: 'The workflow is archived',
        status: 409,
        detail: 'route-lead is archived',
      }),
    );

    const outcome = await command('/workflows/sales/route-lead/turn-on', {
      method: 'POST',
    });

    expect(outcome).toMatchObject({
      ok: false,
      problem: { status: 409, detail: 'route-lead is archived' },
    });
  });

  it('a_body_that_is_not_json_is_still_a_problem', async () => {
    fetchApi.mockResolvedValue(new Response('Bad gateway', { status: 502 }));

    const outcome = await command('/workflows', { method: 'POST' });

    expect(outcome).toMatchObject({
      ok: false,
      problem: { status: 502, title: 'HTTP 502' },
    });
  });

  it('a_platform_that_does_not_answer_is_a_problem_the_form_can_show', async () => {
    fetchApi.mockRejectedValue(new TypeError('fetch failed'));

    const outcome = await command('/workflows', { method: 'POST' });

    expect(outcome).toMatchObject({
      ok: false,
      problem: { status: 503, title: 'The platform is not answering' },
    });
  });

  it('without_the_address_of_the_api_nothing_is_sent', async () => {
    vi.stubEnv('API_URL', '');

    const sending = command('/workflows', { method: 'POST' });

    await expect(sending).rejects.toThrow('API_URL is not set');
    expect(fetchApi).not.toHaveBeenCalled();
  });
});

describe('the session the console keeps', () => {
  beforeEach(() => {
    vi.stubEnv('SESSION_COOKIE_SECURE', 'false');
    cookieStore.set.mockClear();
    cookieStore.delete.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is_the_one_the_api_issued_for_its_lifetime', async () => {
    const response = answer(
      200,
      {},
      {
        'set-cookie': 'sid=new; Max-Age=3600; Path=/; HttpOnly',
      },
    );

    await keepIssuedSession(response);

    expect(cookieStore.set).toHaveBeenCalledWith('console_session', 'sid=new', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    });
  });

  it('a_session_the_api_ended_is_forgotten', async () => {
    const response = answer(200, {}, { 'set-cookie': 'sid=; Max-Age=0' });

    await keepIssuedSession(response);

    expect(cookieStore.delete).toHaveBeenCalledWith('console_session');
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it('an_answer_without_a_session_changes_nothing', async () => {
    const response = answer(200, {});

    await keepIssuedSession(response);

    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(cookieStore.delete).not.toHaveBeenCalled();
  });

  it('under_https_the_cookie_is_pinned_to_the_origin', async () => {
    vi.stubEnv('SESSION_COOKIE_SECURE', 'true');

    await forgetSession();

    expect(cookieStore.delete).toHaveBeenCalledWith('__Host-console_session');
  });
});
