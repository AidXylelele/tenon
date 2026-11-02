export enum AuthorizationKind {
  Header = 'header',
  ClientCredentials = 'client-credentials',
}

export enum EndpointOutcomeKind {
  Responded = 'responded',
  Read = 'read',
  Unreadable = 'unreadable',
  Rejected = 'rejected',
  TimedOut = 'timed-out',
  Unreachable = 'unreachable',
  Unauthorized = 'unauthorized',
  Invalid = 'invalid',
}

export enum RequestPreparationKind {
  Prepared = 'prepared',
  Misconfigured = 'misconfigured',
}
