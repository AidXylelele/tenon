import type {
  AsyncApiOutcome,
  EffectOutcome,
  EmitOutcome,
  GrpcOutcome,
  HttpOutcome,
  ListenOutcome,
  ProcessOutcome,
  ResourceOutcome,
  RpcOutcome,
  TimerOutcome,
  WorkflowOutcome,
} from "../../../api/index.js";
import type {
  InputDecoder,
  SentDecoder,
  StreamSource,
} from "../../../core/index.js";
import { InterpreterError } from "../../../runtime/index.js";
import type { Decoding } from "./decodings.js";
import { hostFailureKinds } from "./failures.js";

export type Taker = Decoding | StreamSource;

type Kinds<Kind extends EffectOutcome["kind"]> = Readonly<Record<Kind, true>>;

type Own<
  Outcome extends EffectOutcome,
  Left extends Outcome["kind"] = never,
> = Kinds<Exclude<Outcome["kind"], "expired" | Left>>;

type TakenKinds = Readonly<Partial<Record<EffectOutcome["kind"], true>>>;

export const timerKinds: Own<TimerOutcome> = { elapsed: true };

export const processStartKinds: Own<ProcessOutcome, "exited" | "killed"> = {
  started: true,
  unstarted: true,
  ...hostFailureKinds,
};

export const workflowStartKinds: Own<
  WorkflowOutcome,
  "completed" | "faulted" | "cancelled"
> = { started: true, missing: true };

export const emitKinds: Own<EmitOutcome> = {
  emitted: true,
  ...hostFailureKinds,
};

export const publishKinds: Own<AsyncApiOutcome, "message" | "closed"> = {
  published: true,
  ...hostFailureKinds,
};

export const httpKinds: Own<HttpOutcome> = {
  responded: true,
  ...hostFailureKinds,
};

export const grpcKinds: Own<GrpcOutcome> = {
  replied: true,
  status: true,
  ...hostFailureKinds,
};

export const rpcKinds: Own<RpcOutcome> = {
  answered: true,
  rpcError: true,
  ...hostFailureKinds,
};

export const processKinds: Own<ProcessOutcome, "started"> = {
  exited: true,
  unstarted: true,
  killed: true,
  ...hostFailureKinds,
};

export const workflowKinds: Own<WorkflowOutcome, "started"> = {
  completed: true,
  faulted: true,
  cancelled: true,
  missing: true,
};

export const resourceKinds: Own<ResourceOutcome> = {
  fetched: true,
  ...hostFailureKinds,
};

export const listenKinds: Own<ListenOutcome> = { event: true };

export const subscriptionKinds: Own<AsyncApiOutcome, "published"> = {
  message: true,
  closed: true,
  ...hostFailureKinds,
};

export function takenKindsOf(taker: Taker): TakenKinds {
  switch (taker.kind) {
    case "input":
      return inputKindsOf(taker);
    case "sent":
      return sentKindsOf(taker);
    case "http":
      return httpKinds;
    case "grpc":
      return grpcKinds;
    case "a2a":
    case "mcp":
      return rpcKinds;
    case "process":
      return processKinds;
    case "workflow":
      return workflowKinds;
    case "document":
      return resourceKinds;
    case "elapsed":
      return timerKinds;
    case "listen":
      return listenKinds;
    case "subscription":
      return subscriptionKinds;
  }
}

export function checkTaken<Kind extends EffectOutcome["kind"]>(
  kinds: Kinds<Kind>,
  outcome: EffectOutcome,
  taker: Taker,
): asserts outcome is Extract<EffectOutcome, { readonly kind: Kind }> {
  checkKindIn(kinds, outcome, taker);
}

function inputKindsOf(decoder: InputDecoder): TakenKinds {
  switch (decoder.awaits) {
    case "timer":
      return timerKinds;
    case "process":
      return processStartKinds;
    case "workflow":
      return workflowStartKinds;
  }
}

function sentKindsOf(decoder: SentDecoder): TakenKinds {
  switch (decoder.awaits) {
    case "emit":
      return emitKinds;
    case "asyncapi":
      return publishKinds;
  }
}

export function checkKindIn(
  kinds: TakenKinds,
  outcome: EffectOutcome,
  taker: Taker,
): void {
  const isTaken = Object.hasOwn(kinds, outcome.kind);

  if (!isTaken) {
    throw new InterpreterError(
      `The ${taker.kind} decoding takes no '${outcome.kind}' outcome.`,
    );
  }
}
