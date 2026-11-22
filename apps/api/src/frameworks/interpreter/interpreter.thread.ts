import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { WorkerAnswer, WorkerCall } from "./interfaces.js";
import { InterpreterWorkerModule } from "../di/interpreter-worker.module.js";
import { InterpreterWorker } from "./interpreter.worker.js";

Logger.overrideLogger(["error"]);
const context = await NestFactory.createApplicationContext(
  InterpreterWorkerModule,
);
const worker = context.get(InterpreterWorker);
const handle = (call: WorkerCall): WorkerAnswer<unknown> => worker.handle(call);

export default handle;
