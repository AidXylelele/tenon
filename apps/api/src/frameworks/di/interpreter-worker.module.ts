import { Module } from "@nestjs/common";
import { createInterpreter } from "interpreter";
import { InterpreterWorker } from "../interpreter/interpreter.worker.js";

@Module({
  providers: [
    { provide: InterpreterWorker.INTERPRETER, useFactory: createInterpreter },
    InterpreterWorker,
  ],
})
export class InterpreterWorkerModule {}
