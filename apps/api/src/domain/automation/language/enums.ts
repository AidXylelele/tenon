export enum TaskKind {
  Call = 'call',
  Do = 'do',
  Emit = 'emit',
  For = 'for',
  Fork = 'fork',
  Raise = 'raise',
  Run = 'run',
  Set = 'set',
  Switch = 'switch',
  Try = 'try',
}

export enum CallKind {
  Http = 'http',
  OpenApi = 'openapi',
}

export enum ExcludedCallKind {
  A2a = 'a2a',
  AsyncApi = 'asyncapi',
  Grpc = 'grpc',
  Mcp = 'mcp',
}

export enum RunKind {
  Workflow = 'workflow',
  Script = 'script',
  Shell = 'shell',
}

export enum ScriptLanguage {
  JavaScript = 'js',
  Python = 'python',
}

export enum ProcessReturn {
  Stdout = 'stdout',
  Stderr = 'stderr',
  Code = 'code',
  All = 'all',
  None = 'none',
}

export enum BackoffKind {
  Constant = 'constant',
  Linear = 'linear',
  Exponential = 'exponential',
}

export enum AuthenticationScheme {
  Basic = 'basic',
  Bearer = 'bearer',
  OAuth2 = 'oauth2',
  Oidc = 'oidc',
}

export enum OAuth2Grant {
  ClientCredentials = 'client_credentials',
}

export enum FlowKeyword {
  Continue = 'continue',
  Exit = 'exit',
  End = 'end',
}

export enum DefaultVariable {
  Item = 'item',
  Index = 'index',
  Error = 'error',
}

export enum ErrorProperty {
  Type = 'type',
  Status = 'status',
  Instance = 'instance',
  Title = 'title',
  Detail = 'detail',
}

export enum FunctionReference {
  CatalogSeparator = '@',
}

export enum PointerToken {
  Separator = '/',
  Tilde = '~',
  EscapedTilde = '~0',
  EscapedSeparator = '~1',
}

export enum Component {
  Authentications = 'authentications',
  Errors = 'errors',
  Functions = 'functions',
  Retries = 'retries',
  Timeouts = 'timeouts',
}

export enum UnsupportedConstruct {
  WaitTask = 'the wait task',
  ListenTask = 'the listen task',
  Schedule = 'schedule',
  Secrets = 'use.secrets',
  Catalogs = 'catalogs, the default catalog included',
  Extensions = 'use.extensions',
  ExcludedCall = 'call with a2a, asyncapi, grpc or mcp',
  Container = 'run with container',
  ScriptSource = 'a script source (an external resource)',
  ScriptLanguage = 'a script language other than js and python',
  Digest = 'digest authentication',
  SecretAuthentication = 'authentication taken from a secret',
  Grant = 'an oauth2 or oidc grant other than client_credentials',
  FractionalDuration = 'a fraction in a duration other than in the smallest of its hours, minutes or seconds',
  RetryExpression = 'a runtime expression as a retry delay, jitter or limit',
}

export enum DslVersion {
  V100 = '1.0.0',
  V101 = '1.0.1',
  V102 = '1.0.2',
  V103 = '1.0.3',
}

export enum Contradiction {
  CommunicationErrorType = 'CTK try.feature filters on https://serverlessworkflow.io/dsl/errors/types/communication, which the specification does not define; the platform raises https://serverlessworkflow.io/spec/1.0.0/errors/communication',
}
