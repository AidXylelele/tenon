import type { ConfigType } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { text } from "express";
import { Logger } from "nestjs-pino";
import { ApiModule } from "./di/api.module.js";
import { httpConfig } from "./di/configs.js";
import { RELEASE_VERSION } from "./release.js";
import { ApiRoute } from "../interface-adapters/api/enums.js";

const app = await NestFactory.create<NestExpressApplication>(ApiModule, {
  bufferLogs: true,
});
app.useSecurityHeaders({ xFrameOptions: { action: "deny" } });
const http = app.get<ConfigType<typeof httpConfig>>(httpConfig.KEY);
app.useLogger(app.get(Logger));

app.set("trust proxy", http.TRUSTED_PROXIES);
app.enableCsrfProtection({
  trustedOrigins: http.TRUSTED_ORIGINS.slice(),
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

await app.listen(http.PORT);
