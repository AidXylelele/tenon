import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { ConfigModule, type ConfigType } from "@nestjs/config";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { LoggerModule } from "nestjs-pino";
import type {
  SerializedError,
  SerializedRequest,
  SerializedResponse,
} from "pino";
import { RequestPath } from "../opentelemetry/request-path.js";
import { loggingConfig } from "./configs.js";

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule.forFeature(loggingConfig)],
      inject: [loggingConfig.KEY],
      useFactory: (logging: ConfigType<typeof loggingConfig>) => {
        const pretty = logging.NODE_ENV === "development";
        return {
          pinoHttp: {
            level: logging.LOG_LEVEL,
            genReqId: (request, response) => {
              const incoming = request.headers["x-request-id"];
              const id =
                typeof incoming === "string" && incoming.length > 0
                  ? incoming
                  : randomUUID();
              response.setHeader("x-request-id", id);
              return id;
            },
            redact: {
              paths: [
                "*.password",
                "*.token",
                "*.newPassword",
                "*.currentPassword",
              ],
              censor: "[redacted]",
            },
            serializers: {
              req: (request: SerializedRequest) => {
                const path = new RequestPath(request.url);
                return {
                  id: request.id,
                  method: request.method,
                  url: path.redacted(),
                  remoteAddress: request.remoteAddress,
                };
              },
              res: (response: SerializedResponse) => ({
                statusCode: response.statusCode,
              }),
              err: (serialized: SerializedError) => {
                const error = serialized.raw;

                if (!(error instanceof DrizzleQueryError)) return serialized;

                const values = error.message.slice(
                  `Failed query: ${error.query}`.length,
                );
                return {
                  ...serialized,
                  message: serialized.message.replace(values, ""),
                  stack: serialized.stack.replace(values, ""),
                  params: undefined,
                };
              },
            },
            autoLogging: {
              ignore: (request) => {
                const path = new RequestPath(request.url);
                return path.isHealth();
              },
            },
            transport: pretty
              ? { target: "pino-pretty", options: { singleLine: true } }
              : undefined,
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
