import { Injectable } from "@nestjs/common";
import { TaskValueKind } from "../../../domain/automation/instances/enums.js";
import type { TaskValue } from "../../../domain/automation/instances/interfaces.js";
import type { JsonValue } from "../../../domain/automation/interfaces.js";
import { Cipher, type TaskValueRow, type TaskValues } from "../interfaces.js";

@Injectable()
export class TaskValueMapper {
  private static readonly MOST_BYTES = 1024 * 1024;

  constructor(private readonly cipher: Cipher) {}

  sealedOf(value: JsonValue): string | null {
    const text = JSON.stringify(value);

    if (!this.#fits(text)) return null;

    return this.cipher.seal(text);
  }

  outputsOf(taskValues: readonly TaskValue[]): string[] {
    return taskValues
      .filter((taskValue) => this.#keptOutput(taskValue))
      .map((taskValue) => taskValue.execution);
  }

  valueOf(sealed: string): JsonValue {
    const text = this.cipher.open(sealed);
    return JSON.parse(text) as JsonValue;
  }

  valuesOf(rows: readonly TaskValueRow[]): ReadonlyMap<string, TaskValues> {
    const recorded = rows.map((row) => row.execution);
    const executions = new Set(recorded);
    const values = Array.from(executions).map((execution) => {
      const own = rows.filter((row) => row.execution === execution);
      const input = this.#kindOf(own, TaskValueKind.Input);
      const output = this.#kindOf(own, TaskValueKind.Output);
      return [execution, { input, output }] as const;
    });
    return new Map(values);
  }

  #keptOutput(taskValue: TaskValue): boolean {
    if (taskValue.kind !== TaskValueKind.Output) return false;

    const text = JSON.stringify(taskValue.value);
    return this.#fits(text);
  }

  #fits(text: string): boolean {
    const bytes = Buffer.byteLength(text, "utf8");
    return bytes <= TaskValueMapper.MOST_BYTES;
  }

  #kindOf(rows: readonly TaskValueRow[], kind: TaskValueKind): JsonValue {
    const row = rows.find((candidate) => candidate.kind === kind);

    if (row === undefined) return null;

    return this.valueOf(row.sealedValue);
  }
}
