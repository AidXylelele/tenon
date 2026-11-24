import type {
  Argument,
  EffectTemplate,
  Export,
  ExportSchema,
  Expression,
  FetchedSchema,
  FilterTemplate,
  ListenSource,
  Perform,
  Program,
  Stream,
  StreamSource,
  SubscriptionSource,
  TaskTerm,
  Term,
  Transform,
} from "../core/index.js";
import {
  asyncApiRequestExpressionsOf,
  heldExpressionsOf,
  placedFiltersOf,
  resourceExpressionsOf,
  subtermsOf,
} from "../core/index.js";
import { TermTable } from "./state/index.js";
import { nothingAcceptedOf } from "./streams/index.js";
import type { HeldTemplate, ListenStart, RunnerStatics } from "./view.js";

const none: readonly Term[] = [];

const noSchemas: readonly ExportSchema[] = [];

type HeldRequest = readonly [HeldTemplate, readonly Expression[]];

export function staticsOf(program: Program): RunnerStatics {
  const terms = TermTable.of(program);
  const all = terms.all();
  const streams = all.filter(isStream);
  const sources = streams.map((stream) => stream.source);
  const held = heldOf(all, sources);
  const tasks = all.filter(isTask);
  const owned = tasks.map((task) => ownTermsOf(task.body));
  const revealed = owned.filter(isRevealed);
  const reading = revealed.flatMap((own) => own.filter(isPerform));
  const effects = reading.map((perform) => perform.effect);
  const readers = new Set<EffectTemplate>(effects);
  const lastReaders = revealed.flatMap(lastReadersOf);
  const releases = new Set<Transform | Export>(lastReaders);
  const listens = sources.filter(isListen);
  const starts = startsOf(listens);
  const triggers = new Set(program.triggers);
  const correlating = correlatingOf(triggers, streams, starts);

  return {
    terms,
    held,
    readers,
    releases,
    listens: starts,
    triggers,
    correlating,
  };
}

function heldOf(
  all: readonly Term[],
  sources: readonly StreamSource[],
): ReadonlyMap<HeldTemplate, readonly Expression[]> {
  const performs = all.filter(isPerform);
  const performed = performs.map(performedOf);
  const schemas = all.flatMap(schemasOf);
  const fetching = schemas.filter(isFetched);
  const fetched = fetching.map(fetchedOf);
  const subscriptions = sources.filter(isSubscription);
  const subscribed = subscriptions.map(subscribedOf);
  const requests = [...performed, ...fetched, ...subscribed];

  return new Map(requests);
}

function startsOf(
  listens: readonly ListenSource[],
): ReadonlyMap<ListenSource, ListenStart> {
  const entries = listens.map((listen) => {
    const start = startOf(listen);
    return [listen, start] as const;
  });

  return new Map(entries);
}

function startOf(listen: ListenSource): ListenStart {
  const filters = placedFiltersOf(listen.strategy);
  const accepted = nothingAcceptedOf(listen.strategy);

  return { filters, accepted };
}

function correlatingOf(
  triggers: ReadonlySet<Stream>,
  streams: readonly Stream[],
  starts: ReadonlyMap<ListenSource, ListenStart>,
): ReadonlySet<Stream> {
  const correlated = correlatedListensOf(starts);
  const listening = streams.filter((stream) => correlated.has(stream.source));
  const correlating = [...triggers, ...listening];

  return new Set(correlating);
}

function correlatedListensOf(
  starts: ReadonlyMap<ListenSource, ListenStart>,
): ReadonlySet<StreamSource> {
  const correlated = new Set<StreamSource>();

  for (const [listen, start] of starts) {
    const isCorrelated = start.filters.some(correlates);

    if (isCorrelated) {
      correlated.add(listen);
    }
  }

  return correlated;
}

function correlates(filter: FilterTemplate): boolean {
  return filter.correlate.length > 0;
}

function performedOf(perform: Perform): HeldRequest {
  const expressions = heldExpressionsOf(perform);
  return [perform.effect, expressions];
}

function fetchedOf(schema: FetchedSchema): HeldRequest {
  const expressions = resourceExpressionsOf(schema.resource);
  return [schema.resource, expressions];
}

function subscribedOf(subscription: SubscriptionSource): HeldRequest {
  const expressions = asyncApiRequestExpressionsOf(subscription.request);
  return [subscription, expressions];
}

function isListen(source: StreamSource): source is ListenSource {
  return source.kind === "listen";
}

function isSubscription(source: StreamSource): source is SubscriptionSource {
  return source.kind === "subscription";
}

function schemasOf(term: Term): readonly ExportSchema[] {
  const isChecking = term.form === "validate" || term.form === "export";

  if (isChecking) {
    return [term.schema];
  }

  return noSchemas;
}

function isFetched(schema: ExportSchema): schema is FetchedSchema {
  return schema.kind === "fetched";
}

function isRevealed(own: readonly Term[]): boolean {
  const reads = own.some(readsAuthorization);
  const performs = own.some(isPerform);
  const isRevealedTo = reads && performs;

  return isRevealedTo;
}

function lastReadersOf(own: readonly Term[]): readonly (Transform | Export)[] {
  const stages = own.filter(isOutputStage);
  const reading = stages.filter(readsAuthorization);
  const exports = reading.filter(isExport);
  const readsAtExport = exports.length > 0;

  if (readsAtExport) {
    return exports;
  }

  return reading;
}

function ownTermsOf(term: Term): readonly Term[] {
  if (term.form === "task") {
    return none;
  }

  const held = subtermsOf(term);
  const inner = held.flatMap(ownTermsOf);

  return [term, ...inner];
}

function readsAuthorization(term: Term): boolean {
  const expressions = heldExpressionsOf(term);
  const read = expressions.flatMap((expression) => expression.arguments);

  return read.some(isOwnAuthorization);
}

function isOwnAuthorization(argument: Argument): boolean {
  const access = argument.access;

  switch (access.kind) {
    case "activation": {
      const isOwn = access.hops === 0 && access.field === "authorization";
      return isOwn;
    }
    case "slot":
    case "store":
    case "run":
    case "secrets":
      return false;
  }
}

function isStream(term: Term): term is Stream {
  return term.form === "stream";
}

function isPerform(term: Term): term is Perform {
  return term.form === "perform";
}

function isOutputStage(term: Term): term is Transform | Export {
  const isStage = term.form === "transform" || term.form === "export";

  return isStage;
}

function isExport(term: Term): term is Export {
  return term.form === "export";
}

function isTask(term: Term): term is TaskTerm {
  return term.form === "task";
}
