import type { Finding, FunctionCall } from "../../syntax/index.js";
import type { Occurrence } from "../occurrences/index.js";
import { nameFindingOf } from "./findings.js";
import { StronglyConnected } from "./strongly-connected.js";
import type { FunctionSymbol, Named, Symbols } from "./types.js";

interface Caller {
  readonly symbol: FunctionSymbol;
  readonly calls: readonly ResolvedCall[];
}

interface ResolvedCall {
  readonly pointer: string;
  readonly callee: FunctionSymbol;
}

const none: readonly Finding[] = [];

const noCallees: readonly ResolvedCall[] = [];

export function recursionFindingsOf(
  occurrences: readonly Occurrence[],
  symbols: Symbols,
): readonly Finding[] {
  const resolved = symbols.references.functions;
  const functions = [...symbols.components.functions.values()];
  const callers = functions.map((symbol) =>
    callerOf(symbol, occurrences, resolved),
  );
  const edges = callers.map(edgesOf);
  const graph = new Map(edges);
  const connected = new StronglyConnected(graph);
  const components = connected.components;

  return callers.flatMap((caller) => closingFindingsOf(caller, components));
}

function callerOf(
  symbol: FunctionSymbol,
  occurrences: readonly Occurrence[],
  resolved: ReadonlyMap<string, FunctionSymbol>,
): Caller {
  const calls = occurrences
    .filter((occurrence) => occurrence.kind === "call")
    .filter(({ context }) => context.function === symbol.name)
    .flatMap(({ call }) => resolvedCallsOf(call, resolved));

  return { symbol, calls };
}

function resolvedCallsOf(
  call: FunctionCall,
  resolved: ReadonlyMap<string, FunctionSymbol>,
): readonly ResolvedCall[] {
  const callee = resolved.get(call.function.pointer);

  if (callee === undefined) {
    return noCallees;
  }

  return [{ pointer: call.pointer, callee }];
}

function edgesOf(
  caller: Caller,
): readonly [FunctionSymbol, readonly FunctionSymbol[]] {
  const callees = caller.calls.map((call) => call.callee);
  return [caller.symbol, callees];
}

function closingFindingsOf(
  caller: Caller,
  components: ReadonlyMap<FunctionSymbol, number>,
): readonly Finding[] {
  const component = components.get(caller.symbol);
  const closing = caller.calls.find(
    (call) => components.get(call.callee) === component,
  );

  if (closing === undefined) {
    return none;
  }

  const named: Named = { pointer: closing.pointer, name: caller.symbol.name };
  return [nameFindingOf("recursiveFunction", "recursive-function", named)];
}
