import {
  Ajv2020,
  type ErrorObject,
  type ValidateFunction,
} from "ajv/dist/2020.js";
import formats from "ajv-formats";
import type { JsonObject, JsonValue } from "../../api/index.js";
import { InterpreterError } from "../faults/index.js";
import { childPointerOf, isJsonObject, pointedValueOf } from "../json/index.js";
import { sentenceOf } from "./sentences.js";
import type {
  SchemaCompilation,
  SchemaCompiler,
  SchemaReferences,
  SchemaViolation,
  Validator,
} from "./types.js";

const options = {
  strict: false,
  allErrors: true,
  logger: false,
  addUsedSchema: false,
} as const;

const notASchema = "A schema must be an object or a boolean.";

const varchar = String.raw`(?:[a-z0-9_]|%[0-9a-f]{2})`;
const varspec = String.raw`${varchar}(?:\.?${varchar})*(?::[1-9]\d{0,3}|\*)?`;
const expression = String.raw`\{[+#./;?&=,!@|]?${varspec}(?:,${varspec})*\}`;
const literal = String.raw`[^\x00-\x20"'<>%\\^\`{|}]|%[0-9a-f]{2}`;
const uriTemplate = new RegExp(`^(?:${literal}|${expression})*$`, "i");

export class JsonSchemas implements SchemaCompiler, SchemaReferences {
  readonly #ajv: Ajv2020;

  constructor(documents: readonly JsonObject[]) {
    const ajv = new Ajv2020(options);
    formats.default(ajv);

    ajv.addFormat("uri-template", uriTemplate);
    const registered = [...documents];
    ajv.addSchema(registered);

    this.#ajv = ajv;
  }

  validatorOf(reference: string): Validator {
    const validate = this.#ajv.getSchema(reference);

    if (validate === undefined) {
      throw new InterpreterError(`The schema '${reference}' is not defined.`);
    }

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

  #validatorOfFunction(validate: ValidateFunction): Validator {
    return (value) => {
      validate(value);
      const errors = validate.errors ?? [];
      return errors.map((error) => this.#violationOf(error, value));
    };
  }

  #violationOf(error: ErrorObject, validated: JsonValue): SchemaViolation {
    const instance = error.instancePath;
    const params: Record<string, unknown> = error.params;
    const property = params.unevaluatedProperty ?? params.additionalProperty;
    const pointer = this.#pointerOf(instance, property);
    const subject = this.#pointerOf(pointer, params.missingProperty);
    const keyword = error.keyword;
    const message = sentenceOf(error, subject);
    const value = pointedValueOf(validated, instance);
    const pattern = typeof params.pattern === "string" ? params.pattern : null;

    return { pointer, instance, keyword, message, subject, value, pattern };
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
