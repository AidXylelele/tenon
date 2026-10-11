import { Mailpit } from './mailpit.js';

export const API_BASE_URL =
  process.env.API_BASE_URL ?? 'http://127.0.0.1:53000';
export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://127.0.0.1:58025';
export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@example.com';
export const ADMIN_PASSWORD =
  process.env.E2E_ADMIN_PASSWORD ?? 'first-admin-password';
export const PASSWORD = 'correct-horse-battery-staple';

export const cookieOf = (response: Response): string =>
  response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');

export const uniqueEmail = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
export class Api {
  readonly mailpit = new Mailpit(MAILPIT_URL);

  call(
    path: string,
    init: { method?: string; body?: unknown; cookie?: string } = {},
  ): Promise<Response> {
    return fetch(`${API_BASE_URL}${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'content-type': 'application/json',
        origin: API_BASE_URL,
        ...(init.cookie ? { cookie: init.cookie } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      redirect: 'manual',
    });
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{ status: number; cookie: string; body: unknown }> {
    const response = await this.call('/api/v1/auth/session', {
      method: 'POST',
      body: { email, password },
    });
    return {
      status: response.status,
      cookie: cookieOf(response),
      body: await response.json(),
    };
  }

  async sessionStatus(cookie: string): Promise<number> {
    return (await this.call('/api/v1/invitations', { cookie })).status;
  }

  async whoAmI(cookie: string): Promise<{ status: number; email?: string }> {
    const response = await this.call('/api/v1/auth/session', { cookie });
    const body = (await response.json()) as { user?: { email: string } };
    return { status: response.status, email: body.user?.email };
  }
  async signInAsAdministrator(): Promise<string> {
    const first = await this.signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (first.status === 200) {
      return first.cookie;
    }
    const requested = await this.call('/api/v1/auth/password-recovery', {
      method: 'POST',
      body: { email: ADMIN_EMAIL },
    });
    if (requested.status !== 202) {
      throw new Error(`Recovery request failed (${requested.status})`);
    }
    const link = await this.mailpit.linkFor(
      ADMIN_EMAIL,
      /https?:\/\/\S+reset-password\?token=\S+/,
    );
    const token = new URL(link).searchParams.get('token') ?? '';
    const reset = await this.call('/api/v1/auth/password-recovery/complete', {
      method: 'POST',
      body: { token, newPassword: ADMIN_PASSWORD },
    });
    if (reset.status !== 204) {
      throw new Error(
        `Recovery failed (${reset.status}): ${await reset.text()}`,
      );
    }
    const second = await this.signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
    if (second.status !== 200) {
      throw new Error(
        `Administrator sign-in failed after recovery (${second.status})`,
      );
    }
    return second.cookie;
  }
  async inviteAndAccept(
    role: 'editor' | 'viewer' = 'editor',
  ): Promise<{ email: string; cookie: string }> {
    const admin = await this.signInAsAdministrator();
    const email = uniqueEmail(role);
    const created = await this.call('/api/v1/invitations', {
      method: 'POST',
      cookie: admin,
      body: { email, role },
    });
    if (created.status !== 201) {
      throw new Error(
        `Invitation failed (${created.status}): ${await created.text()}`,
      );
    }
    const link = await this.mailpit.linkFor(
      email,
      /https?:\/\/\S+invitations\/accept\?token=\S+/,
    );
    const token = new URL(link).searchParams.get('token') ?? '';
    const accepted = await this.call('/api/v1/invitations/accept', {
      method: 'POST',
      body: { token, name: 'Journey User', password: PASSWORD },
    });
    if (accepted.status !== 200) {
      throw new Error(
        `Acceptance failed (${accepted.status}): ${await accepted.text()}`,
      );
    }
    await this.call('/api/v1/auth/session', {
      method: 'DELETE',
      cookie: admin,
    });
    return { email, cookie: cookieOf(accepted) };
  }
}
