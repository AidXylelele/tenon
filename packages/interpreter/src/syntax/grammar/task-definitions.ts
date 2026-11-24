import type { JsonObject, JsonValue } from "../../api/index.js";
import {
  isJsonObject,
  pointedValueOf,
  type SchemaReferences,
} from "../../runtime/index.js";
import { taskKinds, type TaskKind } from "../../standard/index.js";
import { kindOf } from "./task-lists.js";
import type { CallBranch, Definition, SchemaPlace } from "./types.js";
import workflowSchema from "./workflow-schema.json" with { type: "json" };

export const definitionsUri = `${workflowSchema.$id}#/$defs`;

const taskPlaces: readonly JsonObject[] = [
  workflowSchema.$defs.taskList.items.additionalProperties,
  workflowSchema.properties.use.properties.functions.additionalProperties,
];

export class TaskDefinitions {
  readonly #task: Definition;
  readonly #kinds: ReadonlyMap<TaskKind, Definition>;
  readonly #calls: readonly CallBranch[];

  constructor(schemas: SchemaReferences) {
    const taskUri = `${definitionsUri}/task`;
    const validateTask = schemas.validatorOf(taskUri);

    this.#task = {
      validate: validateTask,
      nodes: workflowSchema.$defs.task.oneOf,
    };
    this.#kinds = this.#kindDefinitionsOf(schemas);
    this.#calls = this.#callBranchesOf(schemas);
  }

  levelledOf(place: SchemaPlace): readonly SchemaPlace[] {
    const isTask = taskPlaces.includes(place.node);

    if (!isTask) {
      return [place];
    }

    const { nodes } = this.definitionOf(place.value);
    return nodes.map((node) => ({ node, value: place.value }));
  }

  definitionOf(task: JsonValue): Definition {
    const isTask = isJsonObject(task);

    if (!isTask) {
      return this.#task;
    }

    const kind = kindOf(task);

    if (kind === null) {
      return this.#task;
    }

    const definition = this.#kinds.get(kind) ?? this.#task;

    if (kind !== "call") {
      return definition;
    }

    const call = pointedValueOf(task, "/call");
    const branch = this.#calls.find(({ accepts }) => {
      const violations = accepts(call);
      return violations.length === 0;
    });

    return branch ?? definition;
  }

  #kindDefinitionsOf(
    schemas: SchemaReferences,
  ): ReadonlyMap<TaskKind, Definition> {
    const kinds = taskKinds.map((kind) => {
      const name = `${kind}Task` as const;
      const uri = `${definitionsUri}/${name}`;

      const validate = schemas.validatorOf(uri);
      const node = workflowSchema.$defs[name];
      const definition: Definition = { validate, nodes: [node] };
      return [kind, definition] as const;
    });

    return new Map(kinds);
  }

  #callBranchesOf(schemas: SchemaReferences): readonly CallBranch[] {
    return workflowSchema.$defs.callTask.oneOf.map((node, index) => {
      const branch = `${definitionsUri}/callTask/oneOf/${String(index)}`;
      const call = `${branch}/allOf/1/properties/call`;

      const accepts = schemas.validatorOf(call);
      const validate = schemas.validatorOf(branch);
      return { accepts, validate, nodes: [node] };
    });
  }
}
