import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { InterpreterWorkerModule } from "../di/interpreter-worker.module.js";
import { InterpreterWorker } from "./interpreter.worker.js";

Logger.overrideLogger(["error"]);
const context = await NestFactory.createApplicationContext(
  InterpreterWorkerModule,
);
const worker = context.get(InterpreterWorker);

export const compile = worker.compile.bind(worker);
export const structure = worker.structure.bind(worker);
export const filter = worker.filter.bind(worker);
export const accepting = worker.accepting.bind(worker);
export const start = worker.start.bind(worker);
export const correlate = worker.correlate.bind(worker);
export const respond = worker.respond.bind(worker);
export const suspend = worker.suspend.bind(worker);
export const resume = worker.resume.bind(worker);
export const cancel = worker.cancel.bind(worker);
export const route = worker.route.bind(worker);
export const input = worker.input.bind(worker);
