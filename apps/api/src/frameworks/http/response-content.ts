import { isUtf8 } from "node:buffer";
import { MIMEType } from "node:util";
import { Injectable } from "@nestjs/common";
import type { JsonValue } from "interpreter";
import { BodyReading } from "../../interface-adapters/http/enums.js";
import type {
  HttpReply,
  TextReply,
} from "../../interface-adapters/http/interfaces.js";

@Injectable()
export class ResponseContent {
  private static readonly TEXT_APPLICATIONS: readonly string[] = [
    "xml",
    "javascript",
    "x-www-form-urlencoded",
  ];

  async replyOf(response: Response, reading: BodyReading): Promise<HttpReply> {
    const body = await this.#bodyOf(response);
    const content = this.#contentOf(body, response, reading);
    const headers = this.#headersOf(response);
    return { statusCode: response.status, headers, content };
  }

  async textReplyOf(response: Response): Promise<TextReply> {
    const text = await this.textOf(response);
    return { statusCode: response.status, text };
  }

  async textOf(response: Response): Promise<string> {
    const body = await this.#bodyOf(response);
    const media = this.mediaOf(response);
    return this.#decoded(body, media);
  }

  mediaOf(response: Response): MIMEType | null {
    const contentType = response.headers.get("content-type");

    if (contentType === null) return null;

    try {
      return new MIMEType(contentType);
    } catch {
      return null;
    }
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
    reading: BodyReading,
  ): JsonValue {
    if (body.length === 0) return null;

    if (reading === BodyReading.Raw) return body.toString("base64");

    const media = this.mediaOf(response);
    const json = this.#readsAsJson(media, body);

    if (json) {
      const text = this.#decoded(body, media);
      return this.#documentOf(text);
    }

    const textual = this.#readsAsText(media);

    if (textual) return this.#decoded(body, media);

    return body.toString("base64");
  }

  #documentOf(text: string): JsonValue {
    try {
      return JSON.parse(text) as JsonValue;
    } catch {
      return text;
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
