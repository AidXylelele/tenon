import {
  type JsonObject,
  type JsonValue,
  valueAt,
  withMember,
} from '@/libs/document-text/json';

export interface TaskFormProps {
  readonly task: JsonObject;
  readonly onChange: (task: JsonObject) => void;
}

// Reads and writes inside one task: each form owns its paths, and writes nothing else, so
// constructs it does not know stay as they are (research R5).
export function taskEditor({ task, onChange }: TaskFormProps) {
  return {
    text(path: string): string {
      const value = valueAt(task, path);
      return typeof value === 'string' ? value : '';
    },
    value(path: string): JsonValue | undefined {
      return valueAt(task, path);
    },
    object(path: string): JsonObject {
      const value = valueAt(task, path);
      return typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
        ? value
        : {};
    },
    set(path: string, value: JsonValue | undefined): void {
      onChange(withMember(task, path, value));
    },
  };
}
