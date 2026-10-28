import {
  AuthenticationRegistry,
  SessionCookieProvider,
  type SessionRecord,
} from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../../application/identity/ports.js';
import type { User } from '../../../domain/identity/user.js';

@Injectable()
export class SessionAuthenticationProvider extends SessionCookieProvider<User> {
  constructor(
    private readonly users: UserRepository,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  protected validate(session: SessionRecord): Promise<User | null> {
    return this.users.findActiveById(session.userId);
  }
}
