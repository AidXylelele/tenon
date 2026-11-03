import type { ConformanceStatement } from '../../interface-adapters/workflows/interfaces.js';

// The subset of DSL 1.0.3 this runtime runs, declared once (ER-001): the checks refuse what it
// leaves out, and the platform publishes it as its statement of partial conformance.
export class Conformance {
  static readonly DSL = ['1.0.0', '1.0.1', '1.0.2', '1.0.3'];
  static readonly TASKS = [
    'call',
    'do',
    'emit',
    'for',
    'fork',
    'listen',
    'raise',
    'run',
    'set',
    'switch',
    'try',
    'wait',
  ];
  static readonly CALLS = ['http', 'openapi', 'a function of use.functions'];
  static readonly EXCLUDED_CALLS = ['a2a', 'asyncapi', 'grpc', 'mcp'];
  static readonly RUNS = ['workflow', 'script', 'shell'];
  static readonly SCRIPT_LANGUAGES = ['js', 'javascript', 'python'];
  static readonly AUTHENTICATIONS = [
    'basic',
    'bearer',
    'oauth2 (client_credentials)',
    'oidc (client_credentials)',
    'a policy based on a secret',
  ];
  static readonly EXCLUDED = [
    'run: container',
    'call: grpc, asyncapi, a2a and mcp',
    'catalogs, the default catalog included, and use.extensions',
    'digest and certificate authentication',
    'OAuth2 and OpenID Connect grants other than client_credentials',
    'a runtime expression as a retry delay, jitter or limit',
    'limit.attempt.duration',
    'a backoff with parameters',
    'a fraction of a duration outside its smallest unit',
    'a script from an external resource',
    'a schema from an external resource',
    'listen: foreach and an until of events',
    'schedule.on: all, and an until',
    'evaluate (DSL 1.0.4): runtime expressions are jq in strict mode',
  ];
  static readonly CONTRADICTIONS = [
    'CTK try.feature "Try Handle Caught Error" filters on .../dsl/errors/types/communication; the specification defines .../spec/1.0.0/errors/communication, which the platform raises',
    '$secrets: the argument table lists it in every expression, its description only in input.from; the platform follows the description',
  ];

  static statement(): ConformanceStatement {
    return {
      dsl: Conformance.DSL,
      tasks: Conformance.TASKS,
      calls: Conformance.CALLS,
      runs: Conformance.RUNS,
      scriptLanguages: Conformance.SCRIPT_LANGUAGES,
      authentications: Conformance.AUTHENTICATIONS,
      excluded: Conformance.EXCLUDED,
      contradictions: Conformance.CONTRADICTIONS,
    };
  }
}
