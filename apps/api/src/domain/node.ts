import { ErrorKind, OnError, type TriggerType } from './enums.js';
import type {
  NodeFailure,
  NodeParameters,
  NodePosition,
  NodeProps,
  NodeSettings,
} from './interfaces.js';

export class Node {
  static readonly DEFAULT_SETTINGS: NodeSettings = {
    alwaysOutputData: false,
    executeOnce: false,
    retry: { attempts: 1, waitMs: 0 },
    onError: OnError.Stop,
  };

  static readonly PLATFORM_ATTEMPTS = 3;
  static readonly PLATFORM_FIRST_DELAY_MS = 1_000;
  static readonly UNAVAILABLE_TYPE_FIRST_DELAY_MS = 5_000;
  static readonly UNAVAILABLE_TYPE_MAX_DELAY_MS = 60_000;
  static readonly UNAVAILABLE_TYPE_WINDOW_MS = 15 * 60_000;

  readonly #id: string;
  readonly #name: string;
  readonly #type: string;
  readonly #typeVersion: number;
  readonly #trigger: TriggerType | null;
  readonly #parameters: NodeParameters;
  readonly #credentialId: string | null;
  readonly #settings: NodeSettings;
  readonly #position: NodePosition;
  readonly #note: string | null;
  readonly #disabled: boolean;

  constructor(props: NodeProps) {
    this.#id = props.id;
    this.#name = props.name;
    this.#type = props.type;
    this.#typeVersion = props.typeVersion;
    this.#trigger = props.trigger;
    this.#parameters = props.parameters;
    this.#credentialId = props.credentialId;
    this.#settings = props.settings;
    this.#position = props.position;
    this.#note = props.note;
    this.#disabled = props.disabled;
  }

  get id(): string {
    return this.#id;
  }

  get name(): string {
    return this.#name;
  }

  get type(): string {
    return this.#type;
  }

  get typeVersion(): number {
    return this.#typeVersion;
  }

  get trigger(): TriggerType | null {
    return this.#trigger;
  }

  get parameters(): NodeParameters {
    return this.#parameters;
  }

  get credentialId(): string | null {
    return this.#credentialId;
  }

  get settings(): NodeSettings {
    return this.#settings;
  }

  get position(): NodePosition {
    return this.#position;
  }

  get note(): string | null {
    return this.#note;
  }

  get disabled(): boolean {
    return this.#disabled;
  }

  get isTrigger(): boolean {
    return this.#trigger !== null;
  }

  withoutCredential(): Node {
    return new Node({
      id: this.#id,
      name: this.#name,
      type: this.#type,
      typeVersion: this.#typeVersion,
      trigger: this.#trigger,
      parameters: this.#parameters,
      credentialId: null,
      settings: this.#settings,
      position: this.#position,
      note: this.#note,
      disabled: this.#disabled,
    });
  }

  retryDelay(failure: NodeFailure, attempt: number): number | null {
    if (failure.kind === ErrorKind.User) return this.userRetryDelay(attempt);

    if (failure.kind !== ErrorKind.Platform) return null;

    if (failure.typeUnavailable) return this.unavailableTypeDelay(attempt);

    if (attempt >= Node.PLATFORM_ATTEMPTS) return null;

    return Node.PLATFORM_FIRST_DELAY_MS * 2 ** (attempt - 1);
  }

  private userRetryDelay(attempt: number): number | null {
    if (attempt >= this.#settings.retry.attempts) return null;

    return this.#settings.retry.waitMs;
  }

  private unavailableTypeDelay(attempt: number): number | null {
    let waited = 0;

    for (let previous = 1; previous < attempt; previous++) {
      waited += this.unavailableTypeBackOff(previous);
    }

    if (waited >= Node.UNAVAILABLE_TYPE_WINDOW_MS) return null;

    return this.unavailableTypeBackOff(attempt);
  }

  private unavailableTypeBackOff(attempt: number): number {
    const delay = Node.UNAVAILABLE_TYPE_FIRST_DELAY_MS * 2 ** (attempt - 1);
    return Math.min(delay, Node.UNAVAILABLE_TYPE_MAX_DELAY_MS);
  }
}
