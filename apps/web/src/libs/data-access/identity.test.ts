import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './http';
import { changePassword, currentUser, signIn, signOut } from './identity';

const sessionPair = vi.fn();
const read = vi.fn();
const send = vi.fn();
const command = vi.fn();
const keepIssuedSession = vi.fn();
const forgetSession = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('./http', async () => {
  const { ApiError: Actual } =
    await vi.importActual<typeof import('./http')>('./http');
  return {
    ApiError: Actual,
    sessionPair: () => sessionPair(),
    read: (...args: unknown[]) => read(...args),
    send: (...args: unknown[]) => send(...args),
    command: (...args: unknown[]) => command(...args),
    keepIssuedSession: (...args: unknown[]) => keepIssuedSession(...args),
    forgetSession: () => forgetSession(),
  };
});
vi.mock('next/headers', () => ({}));
vi.mock('next/navigation', () => ({}));

const ADA = { id: 'u-1', email: 'ada@example.com', name: 'Ada', role: 'admin' };

describe('the identity routes', () => {
  beforeEach(() => {
    [
      sessionPair,
      read,
      send,
      command,
      keepIssuedSession,
      forgetSession,
    ].forEach((mock) => mock.mockReset());
  });

  it('without_a_session_there_is_no_user_and_the_api_is_not_asked', async () => {
    sessionPair.mockResolvedValue(null);

    const user = await currentUser();

    expect(user).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('with_a_session_the_user_is_the_one_it_belongs_to', async () => {
    sessionPair.mockResolvedValue('sid=abc');
    read.mockResolvedValue({ user: ADA });

    const user = await currentUser();

    expect(read).toHaveBeenCalledWith('/auth/session');
    expect(user).toEqual(ADA);
  });

  it('signing_in_keeps_the_session_the_api_issued', async () => {
    const response = new Response(JSON.stringify({ user: ADA }), {
      status: 201,
    });
    send.mockResolvedValue(response);

    const outcome = await signIn('ada@example.com', 'correct horse');

    expect(send).toHaveBeenCalledWith('/auth/session', {
      method: 'POST',
      json: { email: 'ada@example.com', password: 'correct horse' },
      anonymous: true,
    });
    expect(keepIssuedSession).toHaveBeenCalledWith(response);
    expect(outcome).toEqual({ ok: true, value: ADA });
  });

  it('a_refused_sign_in_keeps_nothing_and_says_why', async () => {
    const refusal = {
      title: 'Unauthorized',
      detail: 'Wrong email or password',
    };
    send.mockResolvedValue(
      new Response(JSON.stringify(refusal), { status: 401 }),
    );

    const outcome = await signIn('ada@example.com', 'wrong');

    expect(keepIssuedSession).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({
      ok: false,
      problem: { status: 401, detail: 'Wrong email or password' },
    });
  });

  it('a_platform_that_does_not_answer_is_a_problem_the_form_can_show', async () => {
    send.mockRejectedValue(new ApiError(503, 'The platform is not answering'));

    const outcome = await signIn('ada@example.com', 'correct horse');

    expect(outcome).toMatchObject({ ok: false, problem: { status: 503 } });
  });

  it('a_changed_password_keeps_the_rotated_session_and_has_no_value', async () => {
    send.mockResolvedValue(
      new Response(JSON.stringify({ user: ADA }), { status: 200 }),
    );

    const outcome = await changePassword('old password 1', 'new password 2');

    expect(send).toHaveBeenCalledWith('/auth/password', {
      method: 'PATCH',
      json: {
        currentPassword: 'old password 1',
        newPassword: 'new password 2',
      },
      anonymous: false,
    });
    expect(keepIssuedSession).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ ok: true, value: undefined });
  });

  it('signing_out_ends_the_session_at_the_api_and_forgets_it', async () => {
    command.mockResolvedValue({ ok: true, value: undefined });

    await signOut();

    expect(command).toHaveBeenCalledWith('/auth/session', { method: 'DELETE' });
    expect(forgetSession).toHaveBeenCalledTimes(1);
  });
});
