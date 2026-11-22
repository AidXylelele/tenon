import {
  type AuthenticationEvent,
  AuthenticationEvents,
} from "@nestjs/authentication";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";

@Injectable()
export class AuthenticationLogger implements OnModuleInit {
  private readonly logger = new Logger(AuthenticationLogger.name);

  constructor(private readonly events: AuthenticationEvents) {}

  onModuleInit(): void {
    this.events.events$.subscribe((event) => {
      this.#log(event);
    });
  }

  #log(event: AuthenticationEvent): void {
    if (event.type === "session-touch-failed") return;

    const userId = "userId" in event ? event.userId : undefined;
    this.logger.log(
      { event: event.type, userId },
      `Authentication: ${event.type}`,
    );
  }
}
