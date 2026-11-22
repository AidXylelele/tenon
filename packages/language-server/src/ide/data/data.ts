import {
  type Analysis,
  type Binding,
  type JsonValue,
  resolutionsOf,
} from "interpreter/front-end";
import { runtimeExpressionOf } from "../jq-text/index.js";
import { withValueAt } from "../pointers/index.js";
import { modelOf, type Snapshot, sourceOf } from "../snapshot/index.js";
import { type StepNode, stepTreeOf, stepWithId } from "../steps/index.js";
import { inputAndValuesAs, writtenResultOf } from "../variants/index.js";
import { yamlOf } from "../yaml-text/index.js";
import {
  secretEntriesOf,
  stepEntriesOf,
  timeEntriesOf,
  variableEntriesOf,
  workflowInputEntriesOf,
} from "./entries.js";
import { definitionShapeOf } from "./flow.js";
import type {
  DataFlow,
  DataReading,
  DataRequest,
  DataSite,
  DataWarning,
  FieldPlace,
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
  const flow = { tree, jumps: symbols.jumps, document, workflow, secrets };

  return dataInFlowOf(flow, request, speculate);
}

function dataInFlowOf(
  flow: DataFlow,
  request: DataRequest,
  speculate: (text: string) => Analysis,
): DataReading {
  const { step, field } = request;
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
  const site = { flow, node, field, place, scope };

  return dataOf(site);
}

function dataOf(site: DataSite): DataReading {
  const steps = stepEntriesOf(site);
  const input = workflowInputEntriesOf(site);
  const variables = variableEntriesOf(site);
  const secrets = secretEntriesOf(site);
  const times = timeEntriesOf();
  const entries = [...steps, ...input, ...variables, ...secrets, ...times];
  const warnings = warningsOf(site.flow, site.node);

  return { kind: "data", entries, warnings };
}

function warningsOf(flow: DataFlow, node: StepNode): readonly DataWarning[] {
  const written = writtenResultOf(node, flow.document);
  const isMerging = written.as === inputAndValuesAs;
  const incoming = definitionShapeOf(flow, node);
  const isObject = incoming.kind === "object";
  const isWarned = node.task.kind === "set" && isMerging && !isObject;

  if (!isWarned) {
    return [];
  }

  return [{ kind: "inputNotKnownObject", step: node.id }];
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

function unknownStepOf(step: string): string {
  return `No step has the id '${step}'.`;
}

function foreignFieldOf(field: string, node: StepNode): string {
  return `${field} is not a field of the step ${node.id}.`;
}
