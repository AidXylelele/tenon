import {
  type Analysis,
  type Binding,
  type JsonValue,
  resolutionsOf,
} from "interpreter/front-end";
import { runtimeExpressionOf } from "../jq-text/index.js";
import { withValueAt } from "../pointers/index.js";
import { modelOf, type Snapshot, sourceOf } from "../snapshot/index.js";
import {
  type StepNode,
  type StepTree,
  stepTreeOf,
  stepWithId,
} from "../steps/index.js";
import { inputAndValuesAs, writtenResultOf } from "../variants/index.js";
import { yamlOf } from "../yaml-text/index.js";
import {
  secretEntriesOf,
  stepEntriesOf,
  timeEntriesOf,
  variableEntriesOf,
  workflowInputEntriesOf,
} from "./entries.js";
import { exportersByKeyOf } from "./exports.js";
import { chainShapesOf, definitionShapeOf, startShapeOf } from "./flow.js";
import { unknownShape } from "./shapes.js";
import { writtenMembersOf } from "./written.js";
import type {
  DataEntry,
  DataFlow,
  DataReading,
  DataRequest,
  DataSite,
  DataWarning,
  FieldPlace,
  Offered,
} from "./interfaces.js";

const unread: DataReading = {
  kind: "refused",
  reason: "The text does not read; edit it in the text.",
};

const unanalysed: DataReading = {
  kind: "refused",
  reason: "The document has never analysed; edit it in the text.",
};

const probe = runtimeExpressionOf(".");

const noScope: ReadonlyMap<string, Binding> = new Map();

const typedField = /^[A-Za-z_][\w-]*(?:\.[A-Za-z_][\w-]*)*$/;

const memberPlaces: ReadonlyMap<string, FieldPlace> = new Map([
  ["if", "raw"],
  ["input", "raw"],
  ["output", "result"],
  ["export", "result"],
]);

export function dataAtOf(
  snapshot: Snapshot,
  request: DataRequest,
  speculate: (text: string) => Analysis,
): DataReading {
  const source = sourceOf(snapshot.analysis);
  const model = modelOf(snapshot);

  if (source === null) {
    return unread;
  }

  if (model === null) {
    return unanalysed;
  }

  const tree = stepTreeOf(model.workflow);
  const { workflow, symbols } = model;
  const document = source.document;
  const secrets = [...symbols.components.secrets.keys()];
  const targets = new Set(symbols.jumps.values());
  const holders = holdersOf(tree);
  const exporters = exportersByKeyOf(tree, document);
  const flow = {
    tree,
    targets,
    holders,
    exporters,
    document,
    workflow,
    secrets,
  };

  return dataInFlowOf(flow, request, speculate);
}

function holdersOf(tree: StepTree): ReadonlyMap<string, StepNode> {
  const steps = [...tree.steps.values()];
  const held = steps.flatMap((step) =>
    step.lists.map((list) => [list.pointer, step] as const),
  );

  return new Map(held);
}

function dataInFlowOf(
  flow: DataFlow,
  request: DataRequest,
  speculate: (text: string) => Analysis,
): DataReading {
  const { step, field, samples } = request;
  const node = stepWithId(flow.tree, step);

  if (node === null) {
    return { kind: "refused", reason: unknownStepOf(step) };
  }

  const isField = field.startsWith(`${node.pointer}/`);

  if (!isField) {
    return { kind: "refused", reason: foreignFieldOf(field, node) };
  }

  const place = placeOf(node, field);
  const scope = scopeAt(flow.document, field, speculate);
  const shapes = chainShapesOf(flow, node);
  const typed = typedNamesOf(request.typed);
  const site = { flow, node, field, place, scope, shapes, samples, typed };

  return dataOf(site);
}

function dataOf(site: DataSite): DataReading {
  const offered = stepEntriesOf(site);
  const steps = offered.map((each) => each.entry);
  const input = workflowInputEntriesOf(site);
  const variables = variableEntriesOf(site);
  const secrets = secretEntriesOf(site);
  const times = timeEntriesOf(site);
  const entries = [...steps, ...input, ...variables, ...secrets, ...times];
  const merging = mergingWarningsOf(site);
  const skipped = skippedWarningsOf(site, offered);
  const context = contextWarningsOf(site, steps);
  const warnings = [...merging, ...skipped, ...context];
  const written = writtenMembersOf(site.flow.document, site.field, entries);

  return { kind: "data", entries, written, warnings };
}

function mergingWarningsOf(site: DataSite): readonly DataWarning[] {
  const { flow, node, shapes } = site;
  const written = writtenResultOf(node, flow.document);
  const isMerging = written.as === inputAndValuesAs;
  const incoming = shapes.get(node.pointer)?.incoming ?? unknownShape;
  const defined = definitionShapeOf(node, incoming);
  const isObject = defined.kind === "object";
  const isWarned = node.task.kind === "set" && isMerging && !isObject;

  if (!isWarned) {
    return [];
  }

  return [{ kind: "inputNotKnownObject", step: node.id }];
}

function skippedWarningsOf(
  site: DataSite,
  offered: readonly Offered[],
): readonly DataWarning[] {
  const contextual = offered.filter((each) => each.entry.expression !== ".");
  const guarded = contextual.filter((each) =>
    isGuardedFor(site.flow, each.step, site.node),
  );

  return guarded.map((each) => ({
    kind: "mayHoldNothing",
    step: each.step.id,
  }));
}

function contextWarningsOf(
  site: DataSite,
  steps: readonly DataEntry[],
): readonly DataWarning[] {
  const readsContext = steps.some((entry) => entry.expression !== ".");
  const start = startShapeOf(site.flow.workflow);
  const isObject = start.kind === "object";

  if (!readsContext || isObject) {
    return [];
  }

  return [{ kind: "contextNotKnownObject" }];
}

function isGuardedFor(flow: DataFlow, step: StepNode, at: StepNode): boolean {
  const holdsAt = at.pointer.startsWith(`${step.pointer}/`);
  const isGuarded = step.task.if !== null;
  const holder = flow.holders.get(step.list) ?? null;

  if (holdsAt) {
    return false;
  }

  if (isGuarded) {
    return true;
  }

  if (holder === null) {
    return false;
  }

  return isGuardedFor(flow, holder, at);
}

function placeOf(node: StepNode, field: string): FieldPlace {
  const relative = field.slice(node.pointer.length + 1);
  const [member = ""] = relative.split("/");

  return memberPlaces.get(member) ?? "definition";
}

function scopeAt(
  document: JsonValue,
  field: string,
  speculate: (text: string) => Analysis,
): ReadonlyMap<string, Binding> {
  const probed = withValueAt(document, field, probe);
  const text = yamlOf(probed);
  const analysis = speculate(text);

  if (analysis.kind === "refused") {
    return noScope;
  }

  const [resolution] = resolutionsOf(analysis.model, field);
  return resolution?.scope ?? noScope;
}

function typedNamesOf(typed: string | null): readonly string[] | null {
  if (typed === null) {
    return null;
  }

  const text = typed.trim();
  const isField = typedField.test(text);

  if (!isField) {
    return null;
  }

  return text.split(".");
}

function unknownStepOf(step: string): string {
  return `No step has the id '${step}'.`;
}

function foreignFieldOf(field: string, node: StepNode): string {
  return `${field} is not a field of the step ${node.id}.`;
}
