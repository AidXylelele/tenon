import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import formats from "ajv-formats";
import type { JsonObject, JsonValue } from "../../api/index.js";
import { InterpreterError } from "../faults/index.js";
import {
  childPointerOf,
  isJsonObject,
  pointedValueOf,
  rootPointer,
} from "../json/index.js";
import { choiceOf, distinctChoicesOf, linkedViolationsOf } from "./choices.js";
import { schemaLocationsOf } from "./schema-locations.js";
import { sentenceOf } from "./sentences.js";
import type {
  Choice,
  Expansion,
  Report,
  SchemaCompilation,
  SchemaCompiler,
  SchemaLocation,
  SchemaReferences,
  SchemaViolation,
  Validator,
} from "./types.js";

const plainOptions = {
  strict: false,
  allErrors: true,
  logger: false,
  addUsedSchema: false,
} as const;

const tracedOptions = { ...plainOptions, verbose: true } as const;

const notASchema = "A schema must be an object or a boolean.";

const varchar = String.raw`(?:[a-z0-9_]|%[0-9a-f]{2})`;
const varspec = String.raw`${varchar}(?:\.?${varchar})*(?::[1-9]\d{0,3}|\*)?`;
const expression = String.raw`\{[+#./;?&=,!@|]?${varspec}(?:,${varspec})*\}`;
const literal = String.raw`[^\x00-\x20"'<>%\\^\`{|}]|%[0-9a-f]{2}`;
const uriTemplate = new RegExp(`^(?:${literal}|${expression})*$`, "i");

export class JsonSchemas implements SchemaCompiler, SchemaReferences {
  readonly #ajv: Ajv2020;
  readonly #locations: ReadonlyMap<object, SchemaLocation>;

  constructor(documents: readonly JsonObject[]) {
    const isRegistering = documents.length > 0;
    const options = isRegistering ? tracedOptions : plainOptions;
    const ajv = new Ajv2020(options);
    formats.default(ajv);

    ajv.addFormat("uri-template", uriTemplate);
    const registered = [...documents];
    ajv.addSchema(registered);

    this.#ajv = ajv;
    this.#locations = schemaLocationsOf(documents);
  }

  validatorOf(reference: string): Validator {
    const validate = this.#validateFunctionOf(reference);
    return this.#validatorOfFunction(validate);
  }

  compile(schema: JsonValue): SchemaCompilation {
    const isSchema = this.#isSchema(schema);

    if (!isSchema) {
      return { kind: "invalid", message: notASchema };
    }

    const registered = this.#isRegistered(schema);

    try {
      const validate = this.#ajv.compile(schema);
      const validator = this.#validatorOfFunction(validate);
      return { kind: "compiled", validator };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { kind: "invalid", message };
    } finally {
      // Ajv keeps every schema it compiles under its `$id`: one compiled apart
      // is removed after, unless the `$id` is a registered schema's.
      if (!registered) {
        this.#forget(schema);
      }
    }
  }

  #validateFunctionOf(reference: string): ValidateFunction {
    const validate = this.#ajv.getSchema(reference);

    if (validate === undefined) {
      throw new InterpreterError(`The schema '${reference}' is not defined.`);
    }

    return validate;
  }

  #validatorOfFunction(validate: ValidateFunction): Validator {
    return (value) => {
      const reports = this.#reportsOf(validate, value, rootPointer);
      const choices = distinctChoicesOf(reports);
      const entries = choices.map((choice) => {
        const expanded = this.#expansionsOf(choice);
        return [choice.key, expanded] as const;
      });
      const expansions = new Map(entries);

      return linkedViolationsOf(reports, expansions);
    };
  }

  #reportsOf(
    validate: ValidateFunction,
    value: JsonValue,
    base: string,
  ): readonly Report[] {
    validate(value);
    const errors = [...(validate.errors ?? [])];

    return errors.map((error) => this.#reportOf(error, value, base));
  }

  #reportOf(error: ErrorObject, validated: JsonValue, base: string): Report {
    const instance = `${base}${error.instancePath}`;
    const params: Record<string, unknown> = error.params;
    const property = params.unevaluatedProperty ?? params.additionalProperty;
    const pointer = this.#pointerOf(instance, property);
    const subject = this.#pointerOf(pointer, params.missingProperty);
    const keyword = error.keyword;
    const message = sentenceOf(error, subject);
    const value = pointedValueOf(validated, error.instancePath);
    const pattern = typeof params.pattern === "string" ? params.pattern : null;
    const parent = this.#locationOf(error);
    const location = parent?.uri ?? null;
    const ambiguous = Array.isArray(params.passingSchemas);
    const violation: SchemaViolation = {
      pointer,
      instance,
      keyword,
      message,
      subject,
      value,
      pattern,
      location,
      ambiguous,
      branches: [],
    };
    const choice = choiceOf(violation, parent);

    return { violation, choice };
  }

  #locationOf(error: ErrorObject): SchemaLocation | null {
    const parent = error.parentSchema;

    if (parent === undefined) {
      return null;
    }

    return this.#locations.get(parent) ?? null;
  }

  #expansionsOf(choice: Choice): readonly Expansion[] {
    return choice.alternatives.map((schema, index) => {
      const reference = `${choice.reference}/${String(index)}`;
      const validate = this.#validateFunctionOf(reference);
      const reports = this.#reportsOf(validate, choice.value, choice.instance);
      return { schema, reports };
    });
  }

  #pointerOf(parent: string, property: unknown): string {
    return typeof property === "string"
      ? childPointerOf(parent, property)
      : parent;
  }

  #isSchema(value: JsonValue): value is JsonObject | boolean {
    return typeof value === "boolean" || isJsonObject(value);
  }

  #isRegistered(schema: JsonObject | boolean): boolean {
    const isObject = isJsonObject(schema);
    const id = isObject ? schema.$id : undefined;
    return typeof id === "string" && this.#ajv.getSchema(id) !== undefined;
  }

  #forget(schema: JsonObject | boolean): void {
    const isObject = isJsonObject(schema);

    if (isObject) {
      this.#ajv.removeSchema(schema);
    }
  }
}
