import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { InterpreterThreadModule } from "../di/interpreter-thread.module.js";
import { InterpreterTasks } from "./interpreter.tasks.js";

Logger.overrideLogger(["error"]);
const context = await NestFactory.createApplicationContext(
  InterpreterThreadModule,
);
const tasks = context.get(InterpreterTasks);

export const compile = tasks.compile.bind(tasks);
export const structure = tasks.structure.bind(tasks);
export const filter = tasks.filter.bind(tasks);
export const accepting = tasks.accepting.bind(tasks);
export const start = tasks.start.bind(tasks);
export const correlate = tasks.correlate.bind(tasks);
export const respond = tasks.respond.bind(tasks);
export const suspend = tasks.suspend.bind(tasks);
export const resume = tasks.resume.bind(tasks);
export const cancel = tasks.cancel.bind(tasks);
export const route = tasks.route.bind(tasks);
export const input = tasks.input.bind(tasks);
