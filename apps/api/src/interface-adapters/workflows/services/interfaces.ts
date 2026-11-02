import type { JsonObject } from '../../../domain/automation/language/interfaces.js';
import type {
  AuthorizationKind,
  EndpointOutcomeKind,
  RequestPreparationKind,
} from './enums.js';

export interface HttpRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
}

export interface HeaderAuthorization {
  readonly kind: AuthorizationKind.Header;
  readonly scheme: string;
  readonly parameter: string;
}

export interface ClientCredentials {
  readonly kind: AuthorizationKind.ClientCredentials;
  readonly tokenEndpoint: string | null;
  readonly issuer: string | null;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly secretInHeader: boolean;
  readonly scopes: readonly string[];
  readonly audiences: readonly string[];
}

export type Authorization = HeaderAuthorization | ClientCredentials;

export interface SentAuthorization {
  readonly scheme: string;
  readonly parameter: string;
}

// `timeout`: the milliseconds left before the calling task's deadline; null: none.
export interface Exchange {
  readonly request: HttpRequest;
  readonly authorization: Authorization | null;
  readonly timeout: number | null;
}

export interface DocumentRequest {
  readonly url: string;
  readonly authorization: Authorization | null;
  readonly timeout: number | null;
}

export interface EndpointResponded {
  readonly kind: EndpointOutcomeKind.Responded;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
  readonly authorization: SentAuthorization | null;
}

export interface EndpointDocumentRead {
  readonly kind: EndpointOutcomeKind.Read;
  readonly document: JsonObject;
}

export interface EndpointUnreadable {
  readonly kind: EndpointOutcomeKind.Unreadable;
}

export interface EndpointRejected {
  readonly kind: EndpointOutcomeKind.Rejected;
}

export interface EndpointTimedOut {
  readonly kind: EndpointOutcomeKind.TimedOut;
}

export interface EndpointUnreachable {
  readonly kind: EndpointOutcomeKind.Unreachable;
  readonly reason: string;
}

export interface EndpointUnauthorized {
  readonly kind: EndpointOutcomeKind.Unauthorized;
  readonly reason: string;
}

// The request cannot be sent as the author wrote it (a header value undici refuses).
export interface EndpointInvalid {
  readonly kind: EndpointOutcomeKind.Invalid;
  readonly reason: string;
}

export type EndpointFailure =
  | EndpointRejected
  | EndpointTimedOut
  | EndpointUnreachable
  | EndpointUnauthorized
  | EndpointInvalid;

export type ExchangeOutcome = EndpointResponded | EndpointFailure;

export type DocumentOutcome =
  EndpointDocumentRead | EndpointUnreadable | EndpointFailure;

export interface PreparedRequest {
  readonly kind: RequestPreparationKind.Prepared;
  readonly request: HttpRequest;
}

export interface MisconfiguredRequest {
  readonly kind: RequestPreparationKind.Misconfigured;
  readonly reason: string;
}

export type RequestPreparation = PreparedRequest | MisconfiguredRequest;

export abstract class EndpointClient {
  abstract exchange(exchange: Exchange): Promise<ExchangeOutcome>;
  abstract read(request: DocumentRequest): Promise<DocumentOutcome>;
}
