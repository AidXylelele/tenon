import {
  AuthenticationRegistry,
  SessionCookieProvider,
  type SessionRecord,
} from "@nestjs/authentication";
import { Injectable } from "@nestjs/common";
import { ResolveSessionUser } from "../../../application/identity/resolve-session-user.js";
import type { User } from "../../../domain/identity/user.js";

@Injectable()
export class SessionAuthenticationProvider extends SessionCookieProvider<User> {
  constructor(
    private readonly resolveSessionUser: ResolveSessionUser,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  protected async validate(session: SessionRecord): Promise<User | null> {
    const resolved = await this.resolveSessionUser.execute(session.userId);

    if (!resolved.ok) return null;

    return resolved.value;
  }
}
