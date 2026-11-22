import { Module } from "@nestjs/common";
import { createInterpreter } from "interpreter";
import { InterpreterTasks } from "../interpreter/interpreter.tasks.js";

@Module({
  providers: [
    { provide: InterpreterTasks.INTERPRETER, useFactory: createInterpreter },
    InterpreterTasks,
  ],
})
export class InterpreterThreadModule {}
