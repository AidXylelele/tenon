import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject, JsonValue } from '../../../domain/automation/json.js';
import type { CheckProblem } from '../../../interface-adapters/workflows/interfaces.js';
import { TaskKind } from '../enums.js';
import { DefinitionWalk } from '../document/definition-walk.js';
import { Expressions } from '../document/expressions.js';
import { JsonPointer } from '../document/json-pointer.js';
import { JsonWalk } from '../document/json-walk.js';
import type { LocatedTask } from '../document/located-task.js';
import { TaskKinds } from '../document/task-kind.js';
import type { DefinitionCheck } from '../interfaces.js';

// What this runtime cannot run, refused at publish so that nothing is ignored silently (FR-011).
export class SubsetCheck implements DefinitionCheck {
  static readonly #ROOT = new Set([
    'document',
    'input',
    'use',
    'do',
    'timeout',
    'output',
    'schedule',
  ]);
  static readonly #EXCLUDED_CALLS = new Set(['a2a', 'asyncapi', 'grpc', 'mcp']);
  static readonly #LANGUAGES = new Set(['js', 'javascript', 'python']);
  static readonly #CLIENT_AUTHENTICATIONS = new Set([
    'client_secret_post',
    'client_secret_basic',
  ]);
  static readonly #FORM = 'application/x-www-form-urlencoded';
  static readonly #GRANT = 'client_credentials';
  static readonly #SKIPPED = new Set(['document', 'code']);

  firstProblem(workflow: Specification.Workflow): Promise<CheckProblem | null> {
    const problem =
      SubsetCheck.#root(workflow) ??
      SubsetCheck.#schedule(workflow) ??
      SubsetCheck.#use(workflow) ??
      SubsetCheck.#tasks(workflow) ??
      SubsetCheck.#authentications(workflow) ??
      SubsetCheck.#schemas(workflow);
    return Promise.resolve(problem);
  }

  // DSL 1.0.3 leaves the document's root open; anything beyond its seven properties (`evaluate`
  // of 1.0.4, say) would be ignored.
  static #root(workflow: Specification.Workflow): CheckProblem | null {
    for (const key of Object.keys(workflow)) {
      if (SubsetCheck.#ROOT.has(key)) continue;

      const pointer = JsonPointer.ROOT.child(key).toString();
      return {
        pointer,
        detail: `'${key}' is not a property of a DSL 1.0.3 workflow`,
      };
    }

    return null;
  }

  // An event-driven schedule starts an instance per event of one filter, or of any of several;
  // waiting for all of them would hold state between events outside any instance.
  static #schedule(workflow: Specification.Workflow): CheckProblem | null {
    const schedule = workflow.schedule as JsonObject | undefined;
    const on = schedule?.on as JsonObject | undefined;

    if (on?.all === undefined) return null;

    return {
      pointer: '/schedule/on/all',
      detail: 'a schedule on all of several events is not supported',
    };
  }

  static #use(workflow: Specification.Workflow): CheckProblem | null {
    const use = workflow.use as JsonObject | undefined;

    if (use?.catalogs !== undefined)
      return { pointer: '/use/catalogs', detail: 'catalogs are not supported' };

    if (use?.extensions !== undefined)
      return {
        pointer: '/use/extensions',
        detail: 'extensions are not supported',
      };

    const retries = (use?.retries ?? {}) as JsonObject;
    const declared = JsonPointer.ROOT.child('use').child('retries');

    for (const [name, retry] of Object.entries(retries)) {
      const at = declared.child(name);
      const problem = SubsetCheck.retryProblemOf(retry as JsonObject, at);

      if (problem !== null) return problem;
    }

    return null;
  }

  static #tasks(workflow: Specification.Workflow): CheckProblem | null {
    for (const located of DefinitionWalk.tasksOf(workflow)) {
      const problem = SubsetCheck.#task(located);

      if (problem !== null) return problem;
    }

    return null;
  }

  static #task(located: LocatedTask): CheckProblem | null {
    const kind = TaskKinds.of(located.task);

    if (kind === TaskKind.Call) return SubsetCheck.#call(located);

    if (kind === TaskKind.Run) return SubsetCheck.#run(located);

    if (kind === TaskKind.Try) return SubsetCheck.#try(located);

    if (kind === TaskKind.Listen) return SubsetCheck.#listen(located);

    return null;
  }

  static #listen(located: LocatedTask): CheckProblem | null {
    const task = located.task as Specification.ListenTask;

    if (task.foreach !== undefined) {
      const pointer = located.pointer.child('foreach').toString();
      return { pointer, detail: 'listen: foreach is not supported' };
    }

    const to = (task.listen?.to ?? {}) as JsonObject;
    const until = to.until;

    if (until === undefined || typeof until === 'string') return null;

    const pointer = located.pointer
      .child('listen')
      .child('to')
      .child('until')
      .toString();
    return { pointer, detail: 'an until of events is not supported' };
  }

  static #call(located: LocatedTask): CheckProblem | null {
    const call = String((located.task as Specification.CallTask).call);
    const at = located.pointer.child('call').toString();

    if (SubsetCheck.#EXCLUDED_CALLS.has(call))
      return { pointer: at, detail: `call: ${call} is not supported` };

    if (call.includes('@'))
      return {
        pointer: at,
        detail: 'functions from catalogs are not supported',
      };

    return null;
  }

  static #run(located: LocatedTask): CheckProblem | null {
    const run = (located.task as Specification.RunTask).run as JsonObject;
    const at = located.pointer.child('run');

    if (run.container !== undefined) {
      const pointer = at.child('container').toString();
      return { pointer, detail: 'run: container is not supported' };
    }

    const script = run.script as JsonObject | undefined;

    if (script?.source !== undefined) {
      const pointer = at.child('script').child('source').toString();
      return {
        pointer,
        detail: 'a script from an external resource is not supported',
      };
    }

    const language = script?.language;
    const unknownLanguage =
      typeof language === 'string' && !SubsetCheck.#LANGUAGES.has(language);

    if (unknownLanguage) {
      const pointer = at.child('script').child('language').toString();
      return { pointer, detail: `scripts in ${language} are not supported` };
    }

    const workflow = run.workflow as JsonObject | undefined;

    if (workflow?.return !== undefined) {
      const pointer = at.child('workflow').child('return').toString();
      return {
        pointer,
        detail: 'return is not supported on a run workflow task',
      };
    }

    return null;
  }

  static #try(located: LocatedTask): CheckProblem | null {
    const task = located.task as Specification.TryTask;
    const retry = task.catch?.retry;

    if (retry === undefined || typeof retry === 'string') return null;

    const at = located.pointer.child('catch').child('retry');
    return SubsetCheck.retryProblemOf(retry as JsonObject, at);
  }

  // A retry policy, inline or declared in `use.retries`.
  static retryProblemOf(
    retry: JsonObject,
    at: JsonPointer,
  ): CheckProblem | null {
    const values = JsonWalk.valuesOf(retry, SubsetCheck.#SKIPPED);

    for (const located of values) {
      const expression =
        typeof located.value === 'string' &&
        Expressions.encloses(located.value);
      const condition = located.key === 'when' || located.key === 'exceptWhen';

      if (expression && !condition) {
        const pointer = `${at.toString()}${located.pointer.toString()}`;
        return {
          pointer,
          detail: 'a retry delay, jitter or limit cannot be an expression',
        };
      }
    }

    const limit = retry.limit as JsonObject | undefined;
    const attempt = limit?.attempt as JsonObject | undefined;

    if (attempt?.duration !== undefined) {
      const pointer = at
        .child('limit')
        .child('attempt')
        .child('duration')
        .toString();
      return { pointer, detail: 'limit.attempt.duration is not supported' };
    }

    const backoff = retry.backoff as JsonObject | undefined;

    for (const [kind, parameters] of Object.entries(backoff ?? {})) {
      const empty =
        typeof parameters === 'object' &&
        parameters !== null &&
        Object.keys(parameters).length === 0;

      if (empty) continue;

      const pointer = at.child('backoff').child(kind).toString();
      return { pointer, detail: 'the standard defines no backoff parameters' };
    }

    return null;
  }

  static #authentications(
    workflow: Specification.Workflow,
  ): CheckProblem | null {
    const values = JsonWalk.valuesOf(
      workflow as unknown as JsonObject,
      SubsetCheck.#SKIPPED,
    );

    for (const located of values) {
      const policy = SubsetCheck.#policyAt(
        located.key,
        located.pointer,
        located.value,
      );

      if (policy === null) continue;

      const problem = SubsetCheck.#policy(policy, located.pointer);

      if (problem !== null) return problem;
    }

    return null;
  }

  // An authentication policy: inline on an endpoint or call, or declared in
  // `use.authentications`.
  static #policyAt(
    key: string,
    pointer: JsonPointer,
    value: JsonValue,
  ): JsonObject | null {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return null;

    const declared = pointer.toString().startsWith('/use/authentications/');
    const depth = pointer.toString().split('/').length;
    const inUse = declared && depth === 4;

    if (key === 'authentication' || inUse) return value;

    return null;
  }

  static #policy(policy: JsonObject, at: JsonPointer): CheckProblem | null {
    if (policy.digest !== undefined) {
      const pointer = at.child('digest').toString();
      return { pointer, detail: 'digest authentication is not supported' };
    }

    const scheme = (policy.oauth2 ?? policy.oidc) as JsonObject | undefined;

    if (scheme === undefined) return null;

    const name = policy.oauth2 === undefined ? 'oidc' : 'oauth2';
    return SubsetCheck.#oauth2(scheme, at.child(name));
  }

  static #oauth2(scheme: JsonObject, at: JsonPointer): CheckProblem | null {
    if (scheme.use !== undefined) return null;

    if (scheme.grant !== SubsetCheck.#GRANT) {
      const pointer = at.child('grant').toString();
      return {
        pointer,
        detail: 'only the client_credentials grant is supported',
      };
    }

    const client = scheme.client as JsonObject | undefined;
    const identified =
      typeof client?.id === 'string' && typeof client.secret === 'string';

    if (!identified) {
      const pointer = at.child('client').toString();
      return { pointer, detail: 'the client needs an id and a secret' };
    }

    const method = client.authentication;
    const unsupportedMethod =
      typeof method === 'string' &&
      !SubsetCheck.#CLIENT_AUTHENTICATIONS.has(method);

    if (unsupportedMethod) {
      const pointer = at.child('client').child('authentication').toString();
      return {
        pointer,
        detail: `client authentication ${method} is not supported`,
      };
    }

    const request = scheme.request as JsonObject | undefined;
    const encoding = request?.encoding;

    if (encoding !== undefined && encoding !== SubsetCheck.#FORM) {
      const pointer = at.child('request').child('encoding').toString();
      return { pointer, detail: 'a token request is sent as a form only' };
    }

    return null;
  }

  // An author schema is a JSON Schema written in the document (`document`); one taken from an
  // external resource, or in another format, is not read.
  static #schemas(workflow: Specification.Workflow): CheckProblem | null {
    const values = JsonWalk.valuesOf(
      workflow as unknown as JsonObject,
      SubsetCheck.#SKIPPED,
    );

    for (const located of values) {
      if (located.key !== 'schema') continue;

      const schema = located.value as JsonObject;

      if (schema.resource !== undefined) {
        const pointer = located.pointer.child('resource').toString();
        return {
          pointer,
          detail: 'a schema from an external resource is not supported',
        };
      }

      const format = schema.format;

      if (format !== undefined && format !== 'json') {
        const pointer = located.pointer.child('format').toString();
        return {
          pointer,
          detail: 'only JSON Schema (format json) is supported',
        };
      }
    }

    return null;
  }
}
