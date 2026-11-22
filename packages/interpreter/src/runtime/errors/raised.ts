import type { JsonObject, JsonValue } from "../../api/index.js";
import {
  type StandardErrorName,
  standardErrorOf,
  textErrorProperties,
} from "../../standard/index.js";
import { InterpreterError } from "../faults/index.js";
import { isJsonObject } from "../json/index.js";
import type { SchemaViolation } from "../schemas/index.js";
import type { StandardProblem } from "./types.js";

export class Raised extends Error {
  static {
    Object.defineProperty(this.prototype, "name", {
      value: "Raised",
      writable: true,
      configurable: true,
    });
  }

  static standard(name: StandardErrorName, detail: string): Raised {
    const standard = standardErrorOf(name);

    return Raised.withStatus({ name, detail, status: standard.status });
  }

  static withStatus(problem: StandardProblem): Raised {
    const standard = standardErrorOf(problem.name);

    return new Raised({
      type: standard.type,
      status: problem.status,
      title: standard.title,
      detail: problem.detail,
    });
  }

  static refused(violations: readonly SchemaViolation[]): Raised {
    const sentences = violations.map(({ message }) => message);
    const detail = sentences.join(" ");

    return Raised.standard("validation", detail);
  }

  static answered(error: JsonObject): Raised {
    return new Raised(error);
  }

  static written(error: JsonValue): Raised {
    const isObject = isJsonObject(error);

    if (!isObject) {
      throw new InterpreterError(
        "A raise builds its error from an object template.",
      );
    }

    const notText = textErrorProperties.find(
      (property) =>
        Object.hasOwn(error, property) && typeof error[property] !== "string",
    );

    if (notText !== undefined) {
      const detail = `The ${notText} of a raised error is not a string.`;
      return Raised.standard("configuration", detail);
    }

    return new Raised(error);
  }

  readonly error: JsonObject;

  private constructor(error: JsonObject) {
    const message = JSON.stringify(error);

    super(message);
    this.error = error;
  }
}
