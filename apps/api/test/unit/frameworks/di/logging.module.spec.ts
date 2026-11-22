import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { PARAMS_PROVIDER_TOKEN, type Params } from "nestjs-pino";
import { pinoHttp, type Options } from "pino-http";
import { LoggingModule } from "../../../../src/frameworks/di/logging.module.js";

describe("LoggingModule", () => {
  let options: Options;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), LoggingModule],
    }).compile();
    const params = moduleRef.get<Params>(PARAMS_PROVIDER_TOKEN);
    options = params.pinoHttp as Options;
    await moduleRef.close();
  });

  const loggedRecord = (error: Error): string => {
    const lines: string[] = [];
    const { logger } = pinoHttp(options, {
      write: (line: string) => {
        lines.push(line);
      },
    });
    logger.error({ err: error }, "request failed");
    return lines.join("");
  };

  const loggedExchange = (url: string): Record<string, unknown> => {
    const lines: string[] = [];
    const { logger } = pinoHttp(options, {
      write: (line: string) => {
        lines.push(line);
      },
    });
    const request = new IncomingMessage(new Socket());
    request.method = "POST";
    request.url = url;
    request.headers = {
      cookie: "sid=session-secret",
      authorization: "Bearer api-secret",
    };
    const response = new ServerResponse(request);
    response.writeHead(202, { "set-cookie": "sid=session-secret" });
    logger.info({ req: request, res: response }, "request completed");
    const [line] = lines;
    return JSON.parse(line ?? "{}") as Record<string, unknown>;
  };

  it("a_failed_query_is_logged_with_its_statement_and_cause_but_without_the_values_it_carried", () => {
    const record = loggedRecord(
      new DrizzleQueryError(
        'insert into "user" ("email", "password_hash") values ($1, $2)',
        ["someone@example.com", "$scrypt$ln=17,r=8,p=1$c2FsdA$aGFzaA"],
        new Error(
          'duplicate key value violates unique constraint "user_email_unique"',
        ),
      ),
    );
    expect(record).not.toContain("someone@example.com");
    expect(record).not.toContain("$scrypt$");
    expect(record).toContain('insert into \\"user\\"');
    expect(record).toContain("user_email_unique");
  });

  it("other_errors_keep_their_message", () => {
    const record = loggedRecord(
      new Error("the mail server refused the message"),
    );
    expect(record).toContain("the mail server refused the message");
  });

  it("a_request_is_logged_by_its_method_and_path_without_headers_query_or_hook_token", () => {
    const record = loggedExchange("/api/v1/hooks/whk_secret-token?source=crm");

    expect(record.req).toEqual({ method: "POST", url: "/api/v1/hooks/:token" });
    expect(record.res).toEqual({ statusCode: 202 });
    expect(JSON.stringify(record)).not.toContain("secret");
  });
});
