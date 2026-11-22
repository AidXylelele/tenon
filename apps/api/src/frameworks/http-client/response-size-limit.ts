import type {
  HttpClientInterceptor,
  HttpHandler,
  HttpRequest,
} from "@nestjs/http-client";

export class ResponseSizeLimit implements HttpClientInterceptor {
  static readonly EXCEEDED = "ERR_RESPONSE_TOO_LARGE";

  constructor(private readonly bytes: number) {}

  async intercept(request: HttpRequest, next: HttpHandler): Promise<Response> {
    const response = await next(request);
    const counted = response.body?.pipeThrough(this.#counter()) ?? null;
    return new Response(counted, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  }

  #counter(): TransformStream<Uint8Array, Uint8Array> {
    let received = 0;
    return new TransformStream({
      transform: (chunk, controller) => {
        received += chunk.byteLength;

        if (received > this.bytes) {
          controller.error(this.#exceeded());
          return;
        }

        controller.enqueue(chunk);
      },
    });
  }

  #exceeded(): Error {
    const mebibytes = this.bytes / (1024 * 1024);
    const error = new Error(
      `The response is larger than ${String(mebibytes)} MiB`,
    );
    return Object.assign(error, { code: ResponseSizeLimit.EXCEEDED });
  }
}
