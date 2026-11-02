export enum DslOutcomeKind {
  Parsed = 'parsed',
  Failure = 'failure',
  TimedOut = 'timed-out',
  Exhausted = 'exhausted',
}

export enum ExcludedCallKind {
  A2a = 'a2a',
  AsyncApi = 'asyncapi',
  Grpc = 'grpc',
  Mcp = 'mcp',
}

export enum OAuth2Grant {
  ClientCredentials = 'client_credentials',
}

export enum ClientAuthentication {
  SecretPost = 'client_secret_post',
  SecretBasic = 'client_secret_basic',
}

export enum TokenRequestEncoding {
  Form = 'application/x-www-form-urlencoded',
}

export enum EvaluationMode {
  Strict = 'strict',
}

export enum ExpressionLanguage {
  Jq = 'jq',
}

export enum SchemaFormat {
  Json = 'json',
}
