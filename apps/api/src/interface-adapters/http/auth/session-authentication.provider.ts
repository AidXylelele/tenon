import {
  AuthenticationRegistry,
  SessionCookieProvider,
  type SessionRecord,
} from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { ResolveSessionUser } from '../../../application/identity/resolve-session-user.js';
import type { User } from '../../../domain/identity/user.js';

@Injectable()
export class SessionAuthenticationProvider extends SessionCookieProvider<User> {
  constructor(
    private readonly resolveSessionUser: ResolveSessionUser,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  protected validate(session: SessionRecord): Promise<User | null> {
    return this.resolveSessionUser.execute(session.userId);
  }
}
