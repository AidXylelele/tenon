import { SessionService } from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import type { Sessions } from '../../../application/identity/ports.js';

@Injectable()
export class SessionsGateway implements Sessions {
  constructor(private readonly sessions: SessionService) {}

  async endAll(userId: string, except: string | null): Promise<void> {
    if (except === null) {
      await this.sessions.revokeAll(userId);
      return;
    }

    await this.sessions.revokeAll(userId, { except });
  }
}
