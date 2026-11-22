import type { JsonValue } from "interpreter/front-end";
import {
  memberAccessOf,
  runtimeExpressionOf,
  timeExpressions,
} from "../jq-text/index.js";
import { valueAt } from "../pointers/index.js";
import type { StepNode } from "../steps/index.js";
import {
  exportAsPointerOf,
  exportedNameOf,
  exportersOf,
  replacesContextOf,
} from "./exports.js";
import {
  earlierStepsOf,
  isPassingOnOf,
  outputShapeOf,
  producerOf,
  workflowInputShapeOf,
} from "./flow.js";
import type {
  DataEntry,
  DataMember,
  DataSite,
  Origin,
  Reach,
  Shape,
} from "./interfaces.js";
import { textShape, unknownShape } from "./shapes.js";

const credentialHolders: ReadonlySet<string> = new Set([
  "authentication",
  "headers",
]);

const addresses: ReadonlySet<string> = new Set(["endpoint", "uri", "server"]);

const fromWorkflow: Origin = {
  source: "workflowInput",
  step: null,
  needsExport: false,
};

const fromVariable: Origin = {
  source: "variable",
  step: null,
  needsExport: false,
};

const fromSecrets: Origin = {
  source: "secret",
  step: null,
  needsExport: false,
};

const fromClock: Origin = { source: "time", step: null, needsExport: false };

export function stepEntriesOf(site: DataSite): readonly DataEntry[] {
  const { flow, node, place } = site;
  const earlier = earlierStepsOf(flow.tree, node);
  const producer = producerOf(flow, node, place);

  return earlier.flatMap((step, index) => {
    const between = earlier.slice(0, index);
    const reach = { step, between, producer };
    return reachedEntriesOf(site, reach);
  });
}

export function workflowInputEntriesOf(site: DataSite): readonly DataEntry[] {
  const isInScope = site.scope.has("workflow");

  if (!isInScope) {
    return [];
  }

  const shape = workflowInputShapeOf(site.flow.workflow);
  const member = memberOf("input", "$workflow.input", shape);
  return [entryOf(member, fromWorkflow)];
}

export function variableEntriesOf(site: DataSite): readonly DataEntry[] {
  const bindings = [...site.scope];
  const binders = bindings.filter(([, binding]) => binding.kind === "binder");

  return binders.map(([name]) => {
    const member = memberOf(name, `$${name}`, unknownShape);
    return entryOf(member, fromVariable);
  });
}

export function secretEntriesOf(site: DataSite): readonly DataEntry[] {
  const isInScope = site.scope.has("secrets");
  const isCredential = isCredentialFieldOf(site.node, site.field);
  const isOffered = isInScope && isCredential;

  if (!isOffered) {
    return [];
  }

  return site.flow.secrets.map((name) => {
    const expression = memberAccessOf("$secrets", name);
    const member = memberOf(name, expression, textShape);
    return entryOf(member, fromSecrets);
  });
}

export function timeEntriesOf(): readonly DataEntry[] {
  const times = Object.entries(timeExpressions);

  return times.map(([name, expression]) => {
    const member = memberOf(name, expression, textShape);
    return entryOf(member, fromClock);
  });
}

function reachedEntriesOf(site: DataSite, reach: Reach): readonly DataEntry[] {
  const { step, producer } = reach;
  const isPassedOn = isPassingOnOf(step);

  if (isPassedOn) {
    return [];
  }

  if (step === producer) {
    const flowing = flowingEntryOf(site, step);
    return [flowing];
  }

  return exportedEntriesOf(site, reach);
}

function flowingEntryOf(site: DataSite, step: StepNode): DataEntry {
  const shape = outputShapeOf(site.flow, step);
  const member = memberOf(step.name, ".", shape);
  const origin = { source: "step", step: step.id, needsExport: false } as const;

  return entryOf(member, origin);
}

function exportedEntriesOf(site: DataSite, reach: Reach): readonly DataEntry[] {
  const { step, between } = reach;
  const { tree, document } = site.flow;
  const written = exportWrittenOf(site, step);
  const name = exportedNameOf(written);
  const isOwnExport = written !== undefined && name !== step.name;
  const isReplaced = between.some((later) =>
    replacesContextOf(document, later),
  );
  const exporters = exportersOf(tree, document, step.name);
  const isShared = exporters.some((exporter) => exporter !== step);
  const isInScope = site.scope.has("context");
  const isUnreachable = isOwnExport || isReplaced || isShared || !isInScope;

  if (isUnreachable) {
    return [];
  }

  const expression = memberAccessOf("$context", step.name);
  const shape = outputShapeOf(site.flow, step);
  const member = memberOf(step.name, expression, shape);
  const needsExport = written === undefined;
  const origin = { source: "step", step: step.id, needsExport } as const;
  return [entryOf(member, origin)];
}

function exportWrittenOf(
  site: DataSite,
  step: StepNode,
): JsonValue | undefined {
  const pointer = exportAsPointerOf(step.pointer);

  return valueAt(site.flow.document, pointer);
}

function memberOf(name: string, expression: string, shape: Shape): DataMember {
  const value = runtimeExpressionOf(expression);
  const named = [...shape.members];
  const members = named.map(([memberName, memberShape]) => {
    const access = memberAccessOf(expression, memberName);
    return memberOf(memberName, access, memberShape);
  });

  return { name, expression, value, shape: shape.kind, members };
}

function entryOf(member: DataMember, origin: Origin): DataEntry {
  return { ...origin, ...member };
}

function isCredentialFieldOf(node: StepNode, field: string): boolean {
  const relative = field.slice(node.pointer.length + 1);
  const tokens = relative.split("/");
  const last = tokens.at(-1) ?? "";
  const isHeld = tokens.some((token) => credentialHolders.has(token));
  const isAddress = addresses.has(last);

  return isHeld || isAddress;
}
