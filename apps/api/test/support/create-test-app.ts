import {
  type AuthenticationEvent,
  AuthenticationEvents,
  type AuthenticationPasswordResetRequestedEvent,
} from "@nestjs/authentication";
import { MailTransport, type SentMail } from "@nestjs/mail";
import { OutboxRelay } from "@nestjs/outbox";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { SchedulerRegistry } from "@nestjs/schedule";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import { getStorageToken } from "@nestjs/throttler";
import {
  filter,
  firstValueFrom,
  type Observable,
  throwError,
  timeout,
} from "rxjs";
import { text } from "express";
import type { App } from "supertest/types.js";
import { ApiModule } from "../../src/frameworks/di/api.module.js";
import { AutomationBackgroundModule } from "../../src/frameworks/di/automation-background.module.js";
import { IdentityBackgroundModule } from "../../src/frameworks/di/identity-background.module.js";
import { WorkerInterpreterClient } from "../../src/frameworks/interpreter/worker-interpreter.client.js";
import type { Database } from "../../src/interface-adapters/persistence/interfaces.js";
import { getDrizzleToken } from "@nestjs/drizzle";
import { queuedMailCount } from "./db.js";
import { Mailbox } from "./mailbox.js";
import { ProbeController } from "./probe.controller.js";
import { UncountedRequests } from "./uncounted-requests.js";
import { ApiRoute } from "../../src/interface-adapters/api/enums.js";

export interface TestApp {
  readonly app: NestExpressApplication;
  readonly server: App;
  readonly mail: Mailbox;
  readonly db: Database;
  deliverOutbox(): Promise<void>;
  untilMailQueued(): Promise<void>;
  untilMailDeliveredTo(email: string): Promise<SentMail>;
  recoveryHandled(email: string): Promise<void>;
  close(): Promise<void>;
}

const WAIT_MS = 2_000;
const POLL_MS = 50;

const absentInterpreter = Object.freeze({});

export function withoutInterpreter(
  builder: TestingModuleBuilder,
): TestingModuleBuilder {
  return builder
    .overrideProvider(WorkerInterpreterClient)
    .useValue(absentInterpreter);
}

export async function createTestApp(
  customise: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<TestApp> {
  const mail = new Mailbox();
  const builder = Test.createTestingModule({
    imports: [ApiModule, IdentityBackgroundModule, AutomationBackgroundModule],
    controllers: [ProbeController],
  })
    .overrideProvider(MailTransport)
    .useValue(mail)
    .overrideProvider(getStorageToken())
    .useValue(new UncountedRequests());
  const customised = customise(builder);
  const moduleRef = await customised.compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  app.useSecurityHeaders({ xFrameOptions: { action: "deny" } });
  app.set("trust proxy", ["127.0.0.1"]);
  app.enableCsrfProtection({ trustedOrigins: ["http://127.0.0.1:3001"] });
  app.setGlobalPrefix(ApiRoute.Prefix);
  app.useBodyParser("json", {
    limit: "1mb",
    type: ["application/json", "application/*+json"],
  });
  app.use(
    ["/api/v1/events", "/api/v1/hooks"],
    text({ type: () => true, limit: "1mb" }),
  );
  await app.init();
  const scheduler = app.get(SchedulerRegistry);

  for (const name of scheduler.getIntervals()) scheduler.deleteInterval(name);

  const db = app.get<Database>(getDrizzleToken());
  const server = app.getHttpServer() as App;
  const relay = app.get(OutboxRelay);
  const events = app.get(AuthenticationEvents);
  const deliverOutbox = async (): Promise<void> => {
    await relay.runOnce();
  };
  const untilMailDelivered = (email: string): Promise<SentMail> =>
    untilMailDeliveredTo(deliverOutbox, mail, email);
  return {
    app,
    server,
    mail,
    db,
    deliverOutbox,
    untilMailQueued: () => untilMailQueued(db),
    untilMailDeliveredTo: untilMailDelivered,
    recoveryHandled: (email) =>
      recoveryHandled(events, untilMailDelivered, email),
    close: () => app.close(),
  };
}

async function untilMailQueued(db: Database): Promise<void> {
  const started = Date.now();

  for (;;) {
    const queued = await queuedMailCount(db);

    if (queued >= 1) return;

    const elapsed = Date.now() - started;

    if (elapsed >= WAIT_MS) throw new Error("No mail was queued within 2 s");

    await pause();
  }
}

async function untilMailDeliveredTo(
  deliverOutbox: () => Promise<void>,
  mail: Mailbox,
  email: string,
): Promise<SentMail> {
  const started = Date.now();

  for (;;) {
    await deliverOutbox();
    const delivered = mail.lastTo(email);

    if (delivered) return delivered;

    const elapsed = Date.now() - started;

    if (elapsed >= WAIT_MS)
      throw new Error(`No mail was delivered to ${email} within 2 s`);

    await pause();
  }
}

async function recoveryHandled(
  events: AuthenticationEvents,
  untilMailDelivered: (email: string) => Promise<SentMail>,
  email: string,
): Promise<void> {
  const late = new Error(
    `No password reset request for ${email} was handled within 2 s`,
  );
  const requested = filter(
    (
      event: AuthenticationEvent,
    ): event is AuthenticationPasswordResetRequestedEvent =>
      event.type === "password-reset-requested" && event.email === email,
  );
  const bounded = timeout<
    AuthenticationPasswordResetRequestedEvent,
    Observable<never>
  >({
    first: WAIT_MS,
    with: () => throwError(() => late),
  });
  const handled = events.events$.pipe(requested, bounded);
  const request = await firstValueFrom(handled);

  if (request.userId === undefined) return;

  await untilMailDelivered(email);
}

function pause(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, POLL_MS));
}
