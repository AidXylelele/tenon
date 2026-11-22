import type { JsonValue } from "interpreter/front-end";
import {
  memberAccessOf,
  runtimeExpressionOf,
  timeExpressions,
} from "../jq-text/index.js";
import { valueAt } from "../pointers/index.js";
import type { StepNode } from "../steps/index.js";
import {
  blockReplacesContextOf,
  exportAsPointerOf,
  exportedNameOf,
  replacesContextOf,
} from "./exports.js";
import {
  earlierOf,
  isPassingOnOf,
  producerOf,
  workflowInputShapeOf,
} from "./flow.js";
import type {
  DataEntry,
  DataFlow,
  DataMember,
  DataShape,
  DataSite,
  Earlier,
  Offered,
  Origin,
  Reach,
  Shape,
} from "./interfaces.js";
import { literalShapeOf, textShape, unknownShape } from "./shapes.js";

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

const fieldedShapes: ReadonlySet<DataShape> = new Set(["object", "unknown"]);

export function stepEntriesOf(site: DataSite): readonly Offered[] {
  const { flow, node, place } = site;
  const earlier = earlierOf(flow, node);
  const producer = producerOf(flow, node, place);
  const replacing = earlier.map((each) => isReplacingOf(flow, each));
  const firstReplacing = replacing.indexOf(true);

  return earlier.flatMap((each, index) => {
    if (each.kind === "block") {
      return [];
    }

    const isReplaced = firstReplacing !== -1 && firstReplacing < index;
    const reach = { step: each.step, producer, isReplaced };
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
  return [entryOf(member, fromWorkflow, null)];
}

export function variableEntriesOf(site: DataSite): readonly DataEntry[] {
  const bindings = [...site.scope];
  const binders = bindings.filter(([, binding]) => binding.kind === "binder");

  return binders.map(([name]) => {
    const member = memberOf(name, `$${name}`, unknownShape);
    return entryOf(member, fromVariable, null);
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
    return entryOf(member, fromSecrets, null);
  });
}

export function timeEntriesOf(): readonly DataEntry[] {
  const times = Object.entries(timeExpressions);

  return times.map(([name, expression]) => {
    const value = runtimeExpressionOf(expression);
    const member: DataMember = {
      name,
      expression,
      value,
      isPath: false,
      shape: "text",
      members: [],
    };
    return entryOf(member, fromClock, null);
  });
}

function reachedEntriesOf(site: DataSite, reach: Reach): readonly Offered[] {
  const { step, producer } = reach;
  const isPassedOn = isPassingOnOf(step);

  if (isPassedOn) {
    return [];
  }

  if (step === producer) {
    const flowing = flowingEntryOf(site, step);
    return [{ entry: flowing, step }];
  }

  return exportedEntriesOf(site, reach);
}

function flowingEntryOf(site: DataSite, step: StepNode): DataEntry {
  const shape = outputOf(site, step);
  const member = memberOf(step.name, ".", shape);
  const origin = { source: "step", step: step.id, needsExport: false } as const;
  const typed = typedMemberOf(site, member);

  return entryOf(member, origin, typed);
}

function exportedEntriesOf(site: DataSite, reach: Reach): readonly Offered[] {
  const { step, isReplaced } = reach;
  const written = exportWrittenOf(site, step);
  const name = exportedNameOf(written);
  const isOwnExport = written !== undefined && name !== step.name;
  const exporters = site.flow.exporters.get(step.name) ?? [];
  const isShared = exporters.some((exporter) => exporter !== step);
  const isInScope = site.scope.has("context");
  const isUnreachable = isOwnExport || isReplaced || isShared || !isInScope;

  if (isUnreachable) {
    return [];
  }

  const expression = memberAccessOf("$context", step.name);
  const shape = outputOf(site, step);
  const member = memberOf(step.name, expression, shape);
  const needsExport = written === undefined;
  const origin = { source: "step", step: step.id, needsExport } as const;
  const typed = typedMemberOf(site, member);
  const entry = entryOf(member, origin, typed);
  return [{ entry, step }];
}

function isReplacingOf(flow: DataFlow, earlier: Earlier): boolean {
  switch (earlier.kind) {
    case "step":
      return replacesContextOf(flow.document, earlier.step);
    case "block":
      return blockReplacesContextOf(flow.document, earlier.block, earlier.list);
  }
}

function outputOf(site: DataSite, step: StepNode): Shape {
  const output = site.shapes.get(step.pointer)?.output ?? unknownShape;
  const sample = site.samples.get(step.id);
  const isKnown = output.members.size > 0;

  if (isKnown || sample === undefined) {
    return output;
  }

  return literalShapeOf(sample);
}

function typedMemberOf(site: DataSite, member: DataMember): DataMember | null {
  const names = site.typed;

  if (names === null) {
    return null;
  }

  const isFielded = fieldedShapes.has(member.shape);

  if (!isFielded) {
    return null;
  }

  const expression = names.reduce(memberAccessOf, member.expression);
  const isOffered = isOfferedIn(member, expression);

  if (isOffered) {
    return null;
  }

  const name = names.join(".");
  const value = runtimeExpressionOf(expression);
  return {
    name,
    expression,
    value,
    isPath: true,
    shape: "unknown",
    members: [],
  };
}

function isOfferedIn(member: DataMember, expression: string): boolean {
  return member.members.some(
    (each) => each.expression === expression || isOfferedIn(each, expression),
  );
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

  return { name, expression, value, isPath: true, shape: shape.kind, members };
}

function entryOf(
  member: DataMember,
  origin: Origin,
  typed: DataMember | null,
): DataEntry {
  return { ...origin, ...member, typed };
}

function isCredentialFieldOf(node: StepNode, field: string): boolean {
  const relative = field.slice(node.pointer.length + 1);
  const tokens = relative.split("/");
  const last = tokens.at(-1) ?? "";
  const isHeld = tokens.some((token) => credentialHolders.has(token));
  const isAddress = addresses.has(last);

  return isHeld || isAddress;
}
