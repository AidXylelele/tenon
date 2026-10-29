import { AuthenticationPolicy } from '../authentication-policy.js';
import { Endpoint } from '../endpoint.js';
import type { ParsedCallTask, CallTaskProps } from '../interfaces.js';
import type { Scope } from '../scope.js';
import { SupportedSubset } from '../supported-subset.js';
import type { Task } from '../task.js';
import { TaskSettings } from '../task-settings.js';
import { Template } from '../template.js';

export class CallTask implements Task {
  readonly #name: string;
  readonly #reference: string;
  readonly #settings: TaskSettings;
  readonly #kind: string;
  readonly #callee: Task | null;
  readonly #arguments: Template | null;
  readonly #endpoint: Endpoint | null;
  readonly #document: Endpoint | null;
  readonly #authentication: AuthenticationPolicy | null;

  constructor(props: CallTaskProps) {
    this.#name = props.name;
    this.#reference = props.reference;
    this.#settings = props.settings;
    this.#kind = props.kind;
    this.#callee = props.callee;
    this.#arguments = props.arguments;
    this.#endpoint = props.endpoint;
    this.#document = props.document;
    this.#authentication = props.authentication;
  }

  static build(
    name: string,
    parsed: ParsedCallTask,
    scope: Scope,
  ): CallTask | null {
    const kind = parsed.call;
    const callAt = scope.at('call');
    const argumentsAt = scope.at('with');
    const endpointAt = argumentsAt.at('endpoint');
    const documentAt = argumentsAt.at('document').at('endpoint');
    const authenticationAt = argumentsAt.at('authentication');
    const settings = TaskSettings.read(parsed, scope);
    const accepted = SupportedSubset.acceptsCall(kind, callAt);

    if (!accepted) return null;

    const builtIn = SupportedSubset.isBuiltInCall(kind);
    const callee = builtIn ? null : scope.components.function(kind, callAt);

    if (!builtIn && callee === null) return null;

    const args = parsed.with;
    const declaredAuthentication = args?.authentication;
    const argumentsTemplate = Template.read(args, argumentsAt);
    const endpoint = Endpoint.read(args?.endpoint, endpointAt);
    const document = Endpoint.read(args?.document?.endpoint, documentAt);
    const authentication =
      declaredAuthentication === undefined
        ? null
        : AuthenticationPolicy.read(declaredAuthentication, authenticationAt);
    return new CallTask({
      name,
      reference: scope.pointer,
      settings,
      kind,
      callee,
      arguments: argumentsTemplate,
      endpoint,
      document,
      authentication,
    });
  }

  get name(): string {
    return this.#name;
  }

  get reference(): string {
    return this.#reference;
  }

  get settings(): TaskSettings {
    return this.#settings;
  }

  get kind(): string {
    return this.#kind;
  }

  get callee(): Task | null {
    return this.#callee;
  }

  get arguments(): Template | null {
    return this.#arguments;
  }

  get endpoint(): Endpoint | null {
    return this.#endpoint;
  }

  get document(): Endpoint | null {
    return this.#document;
  }

  get authentication(): AuthenticationPolicy | null {
    return this.#authentication;
  }
}
