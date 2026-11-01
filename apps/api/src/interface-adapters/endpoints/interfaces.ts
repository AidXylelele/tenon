import { Dispatcher } from 'undici';

export abstract class EndpointDispatcher extends Dispatcher {}

export interface HttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
}

export interface Authorization {
  readonly scheme: string;
  readonly parameter: string;
}

export interface HttpResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
}
