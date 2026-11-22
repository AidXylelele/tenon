import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { WorkerModule } from "./di/worker.module.js";

const app = await NestFactory.createApplicationContext(WorkerModule, {
  bufferLogs: true,
});
const logger = app.get(Logger);
app.useLogger(logger);
app.enableShutdownHooks();
