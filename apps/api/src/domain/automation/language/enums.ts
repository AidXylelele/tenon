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

export enum RunKind {
  Workflow = 'workflow',
  Script = 'script',
  Shell = 'shell',
}

export enum ScriptLanguage {
  JavaScript = 'js',
  Python = 'python',
}

export enum AuthenticationScheme {
  Basic = 'basic',
  Bearer = 'bearer',
  OAuth2 = 'oauth2',
  Oidc = 'oidc',
}

export enum FlowKeyword {
  Continue = 'continue',
  Exit = 'exit',
  End = 'end',
}

export enum RuntimeArgument {
  Context = 'context',
  Input = 'input',
  Output = 'output',
  Secrets = 'secrets',
  Authorization = 'authorization',
  Task = 'task',
  Workflow = 'workflow',
  Runtime = 'runtime',
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
  SecretsArgument = 'the $secrets argument',
  Catalogs = 'catalogs, the default catalog included',
  Extensions = 'use.extensions',
  ExcludedCall = 'call with a2a, asyncapi, grpc or mcp',
  Container = 'run with container',
  ScriptSource = 'a script source (an external resource)',
  ScriptLanguage = 'a script language the platform does not run',
  Digest = 'digest authentication',
  SecretAuthentication = 'authentication taken from a secret',
  Grant = 'an oauth2 or oidc grant other than client_credentials',
  ClientAuthentication = 'an oauth2 or oidc client without an id and a secret, or authenticated other than by that secret',
  TokenRequestEncoding = 'an oauth2 or oidc token request encoded other than as a form',
  FractionalDuration = 'a fraction in a duration other than in the smallest of its hours, minutes or seconds',
  RetryExpression = 'a runtime expression as a retry delay, jitter or limit',
  RetryAttemptDuration = 'limit.attempt.duration of a retry policy (the specification text bounds all attempts, its schema each attempt)',
  LooseEvaluation = 'the loose evaluation mode',
  ExpressionLanguage = 'a runtime expression language other than jq',
  OtherDslVersion = 'a DSL version outside the supported range',
  SchemaResource = 'a schema taken from an external resource',
  SchemaFormat = 'a schema format other than json',
  CalendarDuration = 'years, months or weeks in a duration',
  BackoffParameters = 'backoff parameters (the standard defines none)',
  UnknownProperty = 'a property the platform does not read at this place',
  WorkflowReturn = 'return on a run workflow task',
}

export enum DslVersion {
  V100 = '1.0.0',
  V101 = '1.0.1',
  V102 = '1.0.2',
  V103 = '1.0.3',
}

export enum Contradiction {
  CommunicationErrorType = 'CTK try.feature filters on https://serverlessworkflow.io/dsl/errors/types/communication, which the specification does not define; the platform raises https://serverlessworkflow.io/spec/1.0.0/errors/communication',
  EmitEventShape = 'dsl-reference types emit.event as event properties, while its example and the schema put them under emit.event.with; the platform follows the schema',
  EmitEventId = 'dsl-reference requires an id when emitting an event, while the schema and CTK emit.feature leave it out; the platform generates the id when it is missing',
}
