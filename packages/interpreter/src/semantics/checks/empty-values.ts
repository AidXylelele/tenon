import { childPointerOf } from "../../runtime/index.js";
import {
  type NonEmptyEventAttribute,
  nonEmptyEventAttributes,
} from "../../standard/index.js";
import type {
  Call,
  ContainerProcess,
  EventFilter,
  EventProperties,
  Finding,
  HttpCall,
  Process,
  Task,
  WorkflowProcess,
} from "../../syntax/index.js";
import { writtenTextOf } from "../written/index.js";
import type { CheckSubject } from "./types.js";

const none: readonly Finding[] = [];

const workflowIdentity = ["namespace", "name", "version"] as const;

type WorkflowIdentityMember = (typeof workflowIdentity)[number];

export function checkEmptyValues(subject: CheckSubject): readonly Finding[] {
  const tasks = subject.occurrences
    .filter((occurrence) => occurrence.kind === "task")
    .map((occurrence) => occurrence.task);
  const filters = subject.occurrences
    .filter((occurrence) => occurrence.kind === "filter")
    .map((occurrence) => occurrence.filter);

  return [
    ...tasks.flatMap(emptyTaskValuesOf),
    ...filters.flatMap(emptyFilterAttributesOf),
  ];
}

function emptyTaskValuesOf(task: Task): readonly Finding[] {
  switch (task.kind) {
    case "call":
      return emptyCallValuesOf(task.call);
    case "emit":
      return emptyEventAttributesOf(task.event);
    case "run":
      return emptyProcessValuesOf(task.process);
    case "do":
    case "for":
    case "fork":
    case "listen":
    case "raise":
    case "set":
    case "switch":
    case "try":
    case "wait":
      return none;
  }
}

function emptyCallValuesOf(call: Call): readonly Finding[] {
  switch (call.kind) {
    case "http":
      return emptyMethodOf(call);
    case "asyncapi":
    case "grpc":
    case "openapi":
    case "a2a":
    case "mcp":
    case "function":
      return none;
  }
}

function emptyMethodOf(call: HttpCall): readonly Finding[] {
  const method = call.method;
  const written = writtenTextOf(method);

  if (written !== "") {
    return none;
  }

  return [
    {
      name: "emptyMethod",
      code: "schema",
      pointer: method.pointer,
      subject: null,
      details: [],
      import: null,
    },
  ];
}

function emptyEventAttributesOf(event: EventProperties): readonly Finding[] {
  return nonEmptyEventAttributes.flatMap((name) =>
    emptyEventAttributeOf(event, name),
  );
}

function emptyEventAttributeOf(
  event: EventProperties,
  name: NonEmptyEventAttribute,
): readonly Finding[] {
  const template = event[name];

  if (template === null) {
    return none;
  }

  const written = writtenTextOf(template);

  if (written !== "") {
    return none;
  }

  return [
    {
      name: "emptyEventAttribute",
      code: "event-attribute",
      pointer: template.pointer,
      subject: name,
      details: [name],
      import: null,
    },
  ];
}

function emptyFilterAttributesOf(filter: EventFilter): readonly Finding[] {
  return nonEmptyEventAttributes.flatMap((name) =>
    emptyFilterAttributeOf(filter, name),
  );
}

function emptyFilterAttributeOf(
  filter: EventFilter,
  name: NonEmptyEventAttribute,
): readonly Finding[] {
  const attribute = filter.with.attributes.get(name);

  if (attribute?.kind !== "pattern") {
    return none;
  }

  if (attribute.pattern !== "") {
    return none;
  }

  return [
    {
      name: "emptyFilterAttribute",
      code: "event-attribute",
      pointer: attribute.pointer,
      subject: name,
      details: [name],
      import: null,
    },
  ];
}

function emptyProcessValuesOf(process: Process): readonly Finding[] {
  switch (process.kind) {
    case "container":
      return emptyImageOf(process);
    case "workflow":
      return emptyIdentityOf(process);
    case "script":
    case "shell":
      return none;
  }
}

function emptyImageOf(container: ContainerProcess): readonly Finding[] {
  const image = container.image;
  const written = writtenTextOf(image);

  if (written !== "") {
    return none;
  }

  return [
    {
      name: "emptyImage",
      code: "schema",
      pointer: image.pointer,
      subject: null,
      details: [],
      import: null,
    },
  ];
}

function emptyIdentityOf(workflow: WorkflowProcess): readonly Finding[] {
  const empty = workflowIdentity.filter((member) => workflow[member] === "");

  return empty.map((member) => emptyIdentityMemberOf(workflow, member));
}

function emptyIdentityMemberOf(
  workflow: WorkflowProcess,
  member: WorkflowIdentityMember,
): Finding<"emptyWorkflowIdentity"> {
  const pointer = childPointerOf(workflow.pointer, member);

  return {
    name: "emptyWorkflowIdentity",
    code: "schema",
    pointer,
    subject: null,
    details: [member],
    import: null,
  };
}
