import { Injectable } from "@nestjs/common";
import { TaskValueKind } from "../../../domain/automation/instances/enums.js";
import type { JsonValue } from "../../../domain/automation/interfaces.js";
import type { TaskValueRow, TaskValues } from "../interfaces.js";
import { Cipher } from "../ports.js";

@Injectable()
export class TaskValueMapper {
  private static readonly MOST_BYTES = 1024 * 1024;

  constructor(private readonly cipher: Cipher) {}

  sealedOf(value: JsonValue): string | null {
    const text = JSON.stringify(value);
    const bytes = Buffer.byteLength(text, "utf8");

    if (bytes > TaskValueMapper.MOST_BYTES) return null;

    return this.cipher.seal(text);
  }

  valueOf(sealed: string): JsonValue {
    const text = this.cipher.open(sealed);
    return JSON.parse(text) as JsonValue;
  }

  valuesOf(rows: readonly TaskValueRow[]): ReadonlyMap<string, TaskValues> {
    const executions = new Set(rows.map((row) => row.execution));
    const values = Array.from(executions).map((execution) => {
      const own = rows.filter((row) => row.execution === execution);
      const input = this.#kindOf(own, TaskValueKind.Input);
      const output = this.#kindOf(own, TaskValueKind.Output);
      return [execution, { input, output }] as const;
    });
    return new Map(values);
  }

  #kindOf(rows: readonly TaskValueRow[], kind: TaskValueKind): JsonValue {
    const row = rows.find((candidate) => candidate.kind === kind);

    if (row === undefined) return null;

    return this.valueOf(row.sealedValue);
  }
}
