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

export interface Exchange {
  readonly request: HttpRequest;
  readonly authorization: Authorization | null;
}

export interface DocumentRequest {
  readonly url: string;
  readonly authorization: Authorization | null;
}

export interface Responded {
  readonly kind: EndpointOutcomeKind.Responded;
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Buffer;
  readonly authorization: SentAuthorization | null;
}

export interface DocumentRead {
  readonly kind: EndpointOutcomeKind.Read;
  readonly document: JsonObject;
}

export interface Unreadable {
  readonly kind: EndpointOutcomeKind.Unreadable;
}

export interface Rejected {
  readonly kind: EndpointOutcomeKind.Rejected;
}

export interface TimedOut {
  readonly kind: EndpointOutcomeKind.TimedOut;
}

export interface Unreachable {
  readonly kind: EndpointOutcomeKind.Unreachable;
  readonly reason: string;
}

export interface Unauthorized {
  readonly kind: EndpointOutcomeKind.Unauthorized;
  readonly reason: string;
}

export type EndpointFailure = Rejected | TimedOut | Unreachable | Unauthorized;

export type ExchangeOutcome = Responded | EndpointFailure;

export type DocumentOutcome = DocumentRead | Unreadable | EndpointFailure;

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
