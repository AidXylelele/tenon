import { SmtpTransport } from '@nestjs/mail';
import { OutboxRelay } from '@nestjs/outbox';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/frameworks/di/app.module.js';
import { Database } from '../../src/interface-adapters/interfaces.js';
import { queuedMailCount } from './db.js';
import { Mailbox } from './mailbox.js';
import { ProbeModule } from './probe.module.js';

export interface TestApp {
  readonly app: NestExpressApplication;
  readonly server: App;
  readonly mail: Mailbox;
  readonly db: Database;
  deliverOutbox(): Promise<void>;
  settle(): Promise<void>;
  close(): Promise<void>;
}

export async function createTestApp(
  customise: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<TestApp> {
  const mail = new Mailbox();
  const builder = Test.createTestingModule({
    imports: [AppModule, ProbeModule],
  })
    .overrideProvider(SmtpTransport)
    .useValue(mail);
  const moduleRef = await customise(builder).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    logger: false,
  });
  app.set('trust proxy', ['127.0.0.1']);
  app.enableCsrfProtection({ trustedOrigins: ['http://127.0.0.1:3001'] });
  app.setGlobalPrefix('api/v1');
  await app.init();
  const db = app.get(Database);
  return {
    app,
    server: app.getHttpServer() as App,
    mail,
    db,
    deliverOutbox: async () => {
      await app.get(OutboxRelay).runOnce();
    },
    settle: async () => {
      const deadline = Date.now() + 2_000;

      while (Date.now() < deadline) {
        const queued = await queuedMailCount(db);

        if (queued > 0) return;

        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    },
    close: () => app.close(),
  };
}
