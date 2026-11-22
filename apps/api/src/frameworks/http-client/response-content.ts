import { isUtf8 } from "node:buffer";
import { MIMEType } from "node:util";
import { Injectable } from "@nestjs/common";
import type { HttpRequest, JsonValue, RespondedHttpOutcome } from "interpreter";
import type { OutboundRequest, ResponseOptions, Signed } from "./interfaces.js";

@Injectable()
export class ResponseContent {
  private static readonly CREDENTIAL_HEADERS: readonly string[] = [
    "authorization",
    "proxy-authorization",
  ];
  private static readonly TEXT_APPLICATIONS: readonly string[] = [
    "xml",
    "javascript",
    "x-www-form-urlencoded",
  ];

  async respondedOf(
    request: OutboundRequest,
    signed: Signed,
    options: ResponseOptions,
  ): Promise<RespondedHttpOutcome> {
    const response = signed.response;
    const body = await this.#bodyOf(response);
    const content = this.#contentOf(body, response, options.output);
    const headers = this.#headersOf(response);
    const authorization = options.revealAuthorization
      ? signed.authorization
      : null;
    const shown = this.#withoutCredentials(request.headers);
    const sent = { method: request.method, uri: request.uri, headers: shown };
    return {
      kind: "responded",
      request: sent,
      statusCode: response.status,
      headers,
      content,
      authorization,
    };
  }

  async textOf(response: Response): Promise<string> {
    const body = await this.#bodyOf(response);
    const media = this.#mediaOf(response);
    return this.#decoded(body, media);
  }

  documentOf(text: string): JsonValue {
    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return text;
    }
  }

  #withoutCredentials(headers: Headers): Readonly<Record<string, string>> {
    const shown = new Headers(headers);

    for (const name of ResponseContent.CREDENTIAL_HEADERS) shown.delete(name);

    return Object.fromEntries(shown);
  }

  #headersOf(response: Response): Readonly<Record<string, string>> {
    const headers = new Map(response.headers);
    const cookies = response.headers.getSetCookie().join(", ");

    if (cookies !== "") headers.set("set-cookie", cookies);

    return Object.fromEntries(headers);
  }

  async #bodyOf(response: Response): Promise<Buffer> {
    const bytes = await response.arrayBuffer();
    return Buffer.from(bytes);
  }

  #contentOf(
    body: Buffer,
    response: Response,
    output: HttpRequest["output"],
  ): JsonValue {
    if (body.length === 0) return null;

    if (output === "raw") return body.toString("base64");

    const media = this.#mediaOf(response);
    const json = this.#readsAsJson(media, body);

    if (json) {
      const text = this.#decoded(body, media);
      return this.documentOf(text);
    }

    const textual = this.#readsAsText(media);

    if (textual) return this.#decoded(body, media);

    return body.toString("base64");
  }

  #mediaOf(response: Response): MIMEType | null {
    const contentType = response.headers.get("content-type");

    if (contentType === null) return null;

    try {
      return new MIMEType(contentType);
    } catch {
      return null;
    }
  }

  #readsAsJson(media: MIMEType | null, body: Buffer): boolean {
    if (media === null) return isUtf8(body);

    if (media.type !== "application") return false;

    const suffixed = media.subtype.endsWith("+json");
    return media.subtype === "json" || suffixed;
  }

  #readsAsText(media: MIMEType | null): boolean {
    if (media === null) return false;

    if (media.type === "text") return true;

    if (media.type !== "application") return false;

    const listed = ResponseContent.TEXT_APPLICATIONS.includes(media.subtype);
    const suffixed = media.subtype.endsWith("+xml");
    return listed || suffixed;
  }

  #decoded(body: Buffer, media: MIMEType | null): string {
    const charset = media?.params.get("charset") ?? "utf-8";

    try {
      return new TextDecoder(charset).decode(body);
    } catch {
      return new TextDecoder("utf-8").decode(body);
    }
  }
}
