import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { text } from "express";
import { Logger } from "nestjs-pino";
import type { Env } from "./di/env.schema.js";
import { MainModule } from "./di/main.module.js";
import { RELEASE_VERSION } from "./release.js";
import { ApiRoute } from "../interface-adapters/api/enums.js";

const app = await NestFactory.create<NestExpressApplication>(MainModule, {
  bufferLogs: true,
});
app.useSecurityHeaders({ xFrameOptions: { action: "deny" } });
const config = app.get(ConfigService<Env, true>);
app.useLogger(app.get(Logger));

app.set("trust proxy", config.get("TRUSTED_PROXIES", { infer: true }));
app.enableCsrfProtection({
  trustedOrigins: config.get("TRUSTED_ORIGINS", { infer: true }).slice(),
});
app.setGlobalPrefix(ApiRoute.Prefix);
app.useBodyParser("json", {
  limit: "1mb",
  type: ["application/json", "application/*+json"],
});
app.use(
  [`/${ApiRoute.Prefix}/events`, `/${ApiRoute.Prefix}/hooks`],
  text({ type: () => true, limit: "1mb" }),
);
app.enableShutdownHooks();

const openApi = new DocumentBuilder()
  .setTitle("Tenon API")
  .setVersion(RELEASE_VERSION)
  .addCookieAuth("sid", { type: "apiKey", in: "cookie" }, "sessionCookie")
  .build();
const document = SwaggerModule.createDocument(app, openApi);
SwaggerModule.setup(`${ApiRoute.Prefix}/docs`, app, document, {
  jsonDocumentUrl: `${ApiRoute.Prefix}/docs-json`,
});

if (config.get("HTTP", { infer: true }) === "on") {
  await app.listen(config.get("PORT", { infer: true }));
} else {
  await app.init();
}
