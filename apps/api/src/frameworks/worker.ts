import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { WorkerModule } from "./di/worker.module.js";

const app = await NestFactory.createApplicationContext(WorkerModule, {
  bufferLogs: true,
});
app.useLogger(app.get(Logger));
app.enableShutdownHooks();
