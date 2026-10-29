import type {
  ConformanceStatement,
  ParsedAuthentication,
  ParsedDocument,
  ParsedScript,
  ParsedUse,
} from './interfaces.js';
import type { Scope } from './scope.js';

const DSL_VERSIONS = ['1.0.0', '1.0.1', '1.0.2', '1.0.3'];

const WORKFLOW_PROPERTIES = [
  'document',
  'input',
  'use',
  'do',
  'timeout',
  'output',
  'schedule',
];

const TASKS = [
  'call',
  'do',
  'emit',
  'for',
  'fork',
  'raise',
  'run',
  'set',
  'switch',
  'try',
];

const CALLS = ['http', 'openapi'];

const OUTSIDE_CALLS = ['a2a', 'asyncapi', 'grpc', 'mcp'];

const RUNS = ['workflow', 'script', 'shell'];

const SCRIPT_LANGUAGES = ['js', 'javascript', 'python'];

const AUTHENTICATION_SCHEMES = ['basic', 'bearer', 'oauth2', 'oidc'] as const;

const CLIENT_CREDENTIALS = 'client_credentials';

const OUTSIDE = {
  wait: 'the wait task',
  listen: 'the listen task',
  schedule: 'schedule',
  secrets: 'use.secrets',
  secretAuthentication: 'authentication taken from a secret',
  catalogs: 'catalogs, the default catalog included',
  extensions: 'use.extensions',
  outsideCall: 'call with grpc, asyncapi, a2a or mcp',
  container: 'run with container',
  scriptSource: 'a script source (an external resource)',
  scriptLanguage: 'a script language other than JavaScript and Python',
  digest: 'digest authentication',
  grant: 'an oauth2 or oidc grant other than client_credentials',
  fractionalDuration:
    'a fraction of years, months, weeks or days in a duration',
  retryExpression: 'a runtime expression as a retry delay, jitter or limit',
} as const;

const CONTRADICTIONS = [
  'CTK try.feature filters on https://serverlessworkflow.io/dsl/errors/types/communication, which the specification does not define; the platform raises https://serverlessworkflow.io/spec/1.0.0/errors/communication',
];

export type OutsideConstruct = keyof typeof OUTSIDE;

export class SupportedSubset {
  static refuse(construct: OutsideConstruct, scope: Scope): void {
    const description = OUTSIDE[construct];
    scope.refuse(`${description} is outside the supported subset`);
  }

  static acceptsDocument(parsed: ParsedDocument, scope: Scope): void {
    const version = parsed.document.dsl;
    const supported = DSL_VERSIONS.includes(version);

    if (!supported)
      scope
        .at('document')
        .at('dsl')
        .refuse(
          `DSL ${version} is not supported; documents must declare 1.0.0 to 1.0.3`,
        );

    if (parsed.schedule !== undefined)
      SupportedSubset.refuse('schedule', scope.at('schedule'));

    for (const property of Object.keys(parsed)) {
      const known = WORKFLOW_PROPERTIES.includes(property);

      if (!known)
        scope
          .at(property)
          .refuse(`"${property}" is not a property of a workflow`);
    }
  }

  static acceptsUse(use: ParsedUse, scope: Scope): void {
    if (use.secrets !== undefined)
      SupportedSubset.refuse('secrets', scope.at('secrets'));

    if (use.catalogs !== undefined)
      SupportedSubset.refuse('catalogs', scope.at('catalogs'));

    if (use.extensions !== undefined)
      SupportedSubset.refuse('extensions', scope.at('extensions'));
  }

  static acceptsCall(kind: string, scope: Scope): boolean {
    const outside = OUTSIDE_CALLS.includes(kind);

    if (outside) {
      SupportedSubset.refuse('outsideCall', scope);
      return false;
    }

    const catalogued = kind.includes('@');

    if (catalogued) {
      SupportedSubset.refuse('catalogs', scope);
      return false;
    }

    return true;
  }

  static isBuiltInCall(kind: string): boolean {
    return CALLS.includes(kind);
  }

  static acceptsScript(script: ParsedScript, scope: Scope): boolean {
    const known = SCRIPT_LANGUAGES.includes(script.language);

    if (!known) {
      SupportedSubset.refuse('scriptLanguage', scope.at('language'));
      return false;
    }

    if (script.source !== undefined) {
      SupportedSubset.refuse('scriptSource', scope.at('source'));
      return false;
    }

    return true;
  }

  static schemeOf(parsed: ParsedAuthentication): string | null {
    const scheme = AUTHENTICATION_SCHEMES.find(
      (name) => parsed[name] !== undefined,
    );
    return scheme ?? null;
  }

  static acceptsAuthentication(
    parsed: ParsedAuthentication,
    scope: Scope,
  ): boolean {
    if (parsed.digest !== undefined) {
      SupportedSubset.refuse('digest', scope.at('digest'));
      return false;
    }

    const scheme = SupportedSubset.schemeOf(parsed);
    const settings = scheme === null ? undefined : parsed[scheme];

    if (
      scheme === null ||
      typeof settings !== 'object' ||
      settings === null ||
      Array.isArray(settings)
    )
      return false;

    const schemeAt = scope.at(scheme);

    if (settings.use !== undefined) {
      SupportedSubset.refuse('secretAuthentication', schemeAt.at('use'));
      return false;
    }

    const grantFree = scheme === 'basic' || scheme === 'bearer';

    if (grantFree || settings.grant === CLIENT_CREDENTIALS) return true;

    SupportedSubset.refuse('grant', schemeAt.at('grant'));
    return false;
  }

  static acceptsDuration(text: string, scope: Scope): boolean {
    const datePart = text.split('T')[0] ?? '';
    const fractional = /\d\.\d+[YMWD]/.test(datePart);

    if (fractional) SupportedSubset.refuse('fractionalDuration', scope);

    return !fractional;
  }

  static statement(): ConformanceStatement {
    const excluded = Object.values(OUTSIDE);
    return {
      dsl: DSL_VERSIONS,
      tasks: TASKS,
      calls: CALLS,
      runs: RUNS,
      scriptLanguages: SCRIPT_LANGUAGES,
      authentications: [
        'basic',
        'bearer',
        'oauth2 (client_credentials)',
        'oidc (client_credentials)',
      ],
      excluded,
      contradictions: CONTRADICTIONS,
    };
  }
}
