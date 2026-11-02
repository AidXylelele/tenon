import type { InstancePosition } from '../../../application/automation/instances/queries.js';
import type { WorkflowPosition } from '../../../application/automation/workflows/queries.js';

// The API's opaque page tokens: the last start time in milliseconds and id, the last position,
// or the last workflow's namespace and name in base64url.
export class CursorMapper {
  static readonly #SEPARATOR = '_';
  static readonly #NAME_SEPARATOR = '\n';
  static readonly #ENCODING = 'base64url';

  static toWorkflowPosition(cursor: string): WorkflowPosition;
  static toWorkflowPosition(
    cursor: string | undefined,
  ): WorkflowPosition | null;
  static toWorkflowPosition(
    cursor: string | undefined,
  ): WorkflowPosition | null {
    if (cursor === undefined) return null;

    const decoded = Buffer.from(cursor, CursorMapper.#ENCODING).toString();
    const [namespace = '', name = ''] = decoded.split(
      CursorMapper.#NAME_SEPARATOR,
    );
    return { namespace, name };
  }

  static fromWorkflowPosition(position: WorkflowPosition): string;
  static fromWorkflowPosition(position: WorkflowPosition | null): string | null;
  static fromWorkflowPosition(
    position: WorkflowPosition | null,
  ): string | null {
    if (position === null) return null;

    const named = `${position.namespace}${CursorMapper.#NAME_SEPARATOR}${position.name}`;
    return Buffer.from(named).toString(CursorMapper.#ENCODING);
  }

  static toInstancePosition(
    cursor: string | undefined,
  ): InstancePosition | null {
    if (cursor === undefined) return null;

    const [epoch = '', id = ''] = cursor.split(CursorMapper.#SEPARATOR);
    const milliseconds = Number(epoch);
    const startedAt = new Date(milliseconds);
    return { startedAt, id };
  }

  static fromInstancePosition(
    position: InstancePosition | null,
  ): string | null {
    if (position === null) return null;

    const milliseconds = String(position.startedAt.getTime());
    return `${milliseconds}${CursorMapper.#SEPARATOR}${position.id}`;
  }

  static toPosition(cursor: string | undefined): number | null {
    if (cursor === undefined) return null;

    return Number(cursor);
  }

  static fromPosition(position: number | null): string | null {
    if (position === null) return null;

    return String(position);
  }
}
