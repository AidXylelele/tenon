import { SessionService } from '@nestjs/authentication';
import { Injectable } from '@nestjs/common';
import { Sessions } from '../../../application/identity/ports.js';

@Injectable()
export class SessionsGateway extends Sessions {
  constructor(private readonly sessions: SessionService) {
    super();
  }

  async endAll(userId: string, except: string | null): Promise<void> {
    if (except === null) {
      await this.sessions.revokeAll(userId);
      return;
    }

    await this.sessions.revokeAll(userId, { except });
  }
}
