import type { JsonValue } from "../../api/index.js";
import {
  childPointerOf,
  isJsonArray,
  isJsonObject,
  pointedValueOf,
  rootPointer,
  type SchemaReferences,
  tokensOf,
  type Validator,
} from "../../runtime/index.js";
import type { Finding } from "../findings.js";
import { deepestViolationsOf } from "./deepest-violations.js";
import { dslVersionFindingsOf } from "./dsl-version.js";
import { referenceViolationsOf } from "./reference-violations.js";
import { schemasAlong } from "./schemas-at.js";
import { standardSchemas } from "./standard-schemas.js";
import { wordedViolationOf } from "./worded-violations.js";
import { definitionsUri, TaskDefinitions } from "./task-definitions.js";
import type { SchemaAt, SchemaPlace, Verdict, Violation } from "./types.js";
import { nestedListsOf } from "./task-lists.js";
import { isStructureIntact } from "./value-violations.js";
import {
  prefixedViolationOf,
  schemaBreachOf,
  violationFindingOf,
} from "./violation-findings.js";
import workflowSchema from "./workflow-schema.json" with { type: "json" };

interface Place {
  readonly value: JsonValue;
  readonly pointer: string;
}

const workflowLists = ["/do"];
const extensionLists = ["/before", "/after"];

export class GrammarCheck {
  readonly #workflow: Validator;
  readonly #filter: Validator;
  readonly #definitions: TaskDefinitions;

  static standard(): GrammarCheck {
    const registry = standardSchemas();
    return new GrammarCheck(registry);
  }

  constructor(schemas: SchemaReferences) {
    const filterUri = `${definitionsUri}/eventFilter`;

    this.#workflow = schemas.validatorOf(workflowSchema.$id);
    this.#filter = schemas.validatorOf(filterUri);
    this.#definitions = new TaskDefinitions(schemas);
  }

  verdictOf(document: JsonValue): Verdict {
    const root: Place = { value: document, pointer: rootPointer };
    const violations = [
      ...this.#workflow(document).map(schemaBreachOf),
      ...this.#nestedViolationsOf(root, workflowLists),
      ...this.#functionViolationsOf(root),
      ...this.#extensionViolationsOf(root),
    ];

    const schema = this.#findingsOfViolations(violations);
    const versions = dslVersionFindingsOf(document);
    const findings = [...schema, ...versions];
    const isSupported = versions.length === 0;
    const isIntact = isStructureIntact(violations);
    const isFormed = isSupported && isIntact;

    if (!isFormed) {
      return { kind: "malformed", findings };
    }

    return { kind: "formed", findings };
  }

  taskFindingsOf(definition: JsonValue, pointer: string): readonly Finding[] {
    const violations = this.#taskViolationsOf({ value: definition, pointer });
    return this.#findingsOfViolations(violations);
  }

  filterFindingsOf(filter: JsonValue): readonly Finding[] {
    const violations = this.#filter(filter).map(schemaBreachOf);
    return this.#findingsOfViolations(violations);
  }

  schemasAt(document: JsonValue, pointer: string): readonly SchemaAt[] {
    const tokens = tokensOf(pointer);
    const root: SchemaPlace = { node: workflowSchema, value: document };

    return schemasAlong(root, tokens, (place) =>
      this.#definitions.levelledOf(place),
    );
  }

  #findingsOfViolations(violations: readonly Violation[]): readonly Finding[] {
    const chosen = deepestViolationsOf(violations);
    const worded = chosen.map((violation) =>
      wordedViolationOf(violation, violations),
    );

    return worded.map(violationFindingOf);
  }

  #nestedViolationsOf(
    owner: Place,
    lists: readonly string[],
  ): readonly Violation[] {
    const places = lists.map((list) => this.#placeOf(owner, list));
    return places.flatMap((list) => this.#listViolationsOf(list));
  }

  #placeOf(owner: Place, pointer: string): Place {
    const value = pointedValueOf(owner.value, pointer);
    return { value, pointer: `${owner.pointer}${pointer}` };
  }

  #listViolationsOf(list: Place): readonly Violation[] {
    const items = this.#itemsOf(list);
    const tasks = items.flatMap((item) => this.#membersOf(item));
    return tasks.flatMap((task) => this.#taskViolationsOf(task));
  }

  #itemsOf(list: Place): readonly Place[] {
    const written = list.value;
    const isList = isJsonArray(written);
    const items = isList ? written : [];

    return items.map((value, index) => {
      const pointer = childPointerOf(list.pointer, index);
      return { value, pointer };
    });
  }

  #membersOf(item: Place): readonly Place[] {
    const written = item.value;
    const isObject = isJsonObject(written);

    if (!isObject) {
      return [];
    }

    const entries = Object.entries(written);

    return entries.map(([name, value]) => {
      const pointer = childPointerOf(item.pointer, name);
      return { value, pointer };
    });
  }

  #taskViolationsOf(task: Place): readonly Violation[] {
    const { validate } = this.#definitions.definitionOf(task.value);
    const violations = validate(task.value).map(schemaBreachOf);
    const required = referenceViolationsOf(task.value);
    const own = [...violations, ...required].map((violation) =>
      prefixedViolationOf(violation, task.pointer),
    );

    const lists = nestedListsOf(task.value);
    const nested = this.#nestedViolationsOf(task, lists);

    return [...own, ...nested];
  }

  #functionViolationsOf(root: Place): readonly Violation[] {
    const functions = this.#placeOf(root, "/use/functions");
    const bodies = this.#membersOf(functions);

    return bodies.flatMap((body) => this.#taskViolationsOf(body));
  }

  #extensionViolationsOf(root: Place): readonly Violation[] {
    const extensions = this.#placeOf(root, "/use/extensions");
    const items = this.#itemsOf(extensions);
    const named = items.flatMap((item) => this.#membersOf(item));

    return named.flatMap((extension) =>
      this.#nestedViolationsOf(extension, extensionLists),
    );
  }
}
