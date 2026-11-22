import type {
  HttpClientInterceptor,
  HttpHandler,
  HttpRequest,
} from "@nestjs/http-client";

export class ResponseSizeLimit implements HttpClientInterceptor {
  static readonly EXCEEDED = "ERR_RESPONSE_TOO_LARGE";

  constructor(readonly bytes: number) {}

  async intercept(request: HttpRequest, next: HttpHandler): Promise<Response> {
    const response = await next(request);
    const counter = this.#counter();
    const counted = response.body?.pipeThrough(counter) ?? null;
    return new Response(counted, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  inMebibytes(): string {
    const mebibytes = this.bytes / (1024 * 1024);
    return `${String(mebibytes)} MiB`;
  }

  #counter(): TransformStream<Uint8Array, Uint8Array> {
    let received = 0;
    return new TransformStream({
      transform: (chunk, controller) => {
        received += chunk.byteLength;

        if (received > this.bytes) {
          const exceeded = this.#exceeded();
          controller.error(exceeded);
          return;
        }

        controller.enqueue(chunk);
      },
    });
  }

  #exceeded(): Error {
    const size = this.inMebibytes();
    const error = new Error(`The response is larger than ${size}`);
    return Object.assign(error, { code: ResponseSizeLimit.EXCEEDED });
  }
}
