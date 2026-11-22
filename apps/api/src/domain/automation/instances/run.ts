import type { JsonObject, JsonValue } from "../interfaces.js";
import type { RunSecrets } from "../secrets/run-secrets.js";
import type {
  AwaitedEffect,
  EventOffer,
  Listening,
  Receiving,
  RunProps,
  RunTurn,
  RunWait,
  TakenEvent,
} from "./interfaces.js";

export class Run {
  readonly #fingerprint: string;
  readonly #format: number;
  readonly #memento: JsonObject;
  readonly #awaited: readonly AwaitedEffect[];
  readonly #listening: readonly Listening[];
  readonly #receiving: readonly Receiving[];
  readonly #taken: readonly TakenEvent[];
  readonly #secretTexts: readonly string[];
  readonly #output: JsonValue | null;
  readonly #error: JsonObject | null;

  constructor(props: RunProps) {
    this.#fingerprint = props.fingerprint;
    this.#format = props.format;
    this.#memento = props.memento;
    this.#awaited = props.awaited;
    this.#listening = props.listening;
    this.#receiving = props.receiving;
    this.#taken = props.taken;
    this.#secretTexts = props.secretTexts;
    this.#output = props.output;
    this.#error = props.error;
  }

  static begun(turn: RunTurn, secrets: RunSecrets): Run {
    const none = new Run({
      fingerprint: turn.fingerprint,
      format: turn.format,
      memento: turn.memento,
      awaited: [],
      listening: [],
      receiving: [],
      taken: [],
      secretTexts: [],
      output: null,
      error: null,
    });
    return none.after(turn, secrets);
  }

  get fingerprint(): string {
    return this.#fingerprint;
  }

  get format(): number {
    return this.#format;
  }

  get memento(): JsonObject {
    return this.#memento;
  }

  get awaited(): readonly AwaitedEffect[] {
    return this.#awaited;
  }

  get listening(): readonly Listening[] {
    return this.#listening;
  }

  get receiving(): readonly Receiving[] {
    return this.#receiving;
  }

  get taken(): readonly TakenEvent[] {
    return this.#taken;
  }

  get secretTexts(): readonly string[] {
    return this.#secretTexts;
  }

  get output(): JsonValue | null {
    return this.#output;
  }

  get error(): JsonObject | null {
    return this.#error;
  }

  get waiting(): boolean {
    const awaitsSomething = this.#awaited.length > 0;
    const onlyWaits = this.#awaited.every((effect) => effect.wait !== null);
    return awaitsSomething && onlyWaits;
  }

  get waits(): RunWait[] {
    return this.#awaited.flatMap((effect) =>
      effect.wait === null ? [] : [effect.wait],
    );
  }

  awaits(effectId: string): boolean {
    return this.#awaited.some((effect) => effect.id === effectId);
  }

  mayTake(offer: EventOffer): boolean {
    const takenBefore = this.#taken.some(
      (taken) => taken.eventId === offer.eventId,
    );

    if (takenBefore) return false;

    const listening = this.listeningFor(offer);
    return listening.length > 0;
  }

  listeningFor(offer: EventOffer): readonly Listening[] {
    return this.#listening.filter((listening) =>
      offer.candidates.includes(listening.execution),
    );
  }

  after(turn: RunTurn, secrets: RunSecrets): Run {
    const known = this.#awaited.concat(turn.requested);
    const awaited = known.filter(
      (effect) =>
        !turn.answered.includes(effect.id) &&
        !turn.withdrawn.includes(effect.id),
    );
    const awaitedIds = awaited.map((effect) => effect.id);
    const listening = this.#listening
      .concat(turn.listening)
      .filter((listen) => awaitedIds.includes(listen.effectId));
    const executions = listening.map((listen) => listen.execution);
    const taken = this.#takenAfter(turn).filter((event) =>
      executions.includes(event.execution),
    );
    const receiving = this.#receivingAfter(turn);
    const secretTexts = secrets.textsWith(this.#secretTexts);
    return new Run({
      fingerprint: this.#fingerprint,
      format: turn.format,
      memento: turn.memento,
      awaited,
      listening,
      receiving,
      taken,
      secretTexts,
      output: turn.output,
      error: turn.error,
    });
  }

  #receivingAfter(turn: RunTurn): readonly Receiving[] {
    const renewed = turn.receiving.map((receive) => receive.execution);
    const kept = this.#receiving.filter(
      (receive) => !renewed.includes(receive.execution),
    );
    return kept
      .concat(turn.receiving)
      .filter((receive) => !turn.endedExecutions.includes(receive.execution));
  }

  #takenAfter(turn: RunTurn): readonly TakenEvent[] {
    if (turn.taken === null) return this.#taken;

    return this.#taken.concat([turn.taken]);
  }
}
