import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { createInterpreter } from "interpreter";
import { InterpreterTasks } from "../interpreter/interpreter.tasks.js";
import { interpreterConfig } from "./configs.js";

@Module({
  imports: [ConfigModule.forFeature(interpreterConfig)],
  providers: [
    {
      provide: InterpreterTasks.INTERPRETER,
      inject: [interpreterConfig.KEY],
      useFactory: (interpreter: ConfigType<typeof interpreterConfig>) =>
        createInterpreter({ legacyEventTypes: interpreter.LEGACY_EVENT_TYPES }),
    },
    InterpreterTasks,
  ],
})
export class InterpreterThreadModule {}
