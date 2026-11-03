import type { WorkflowPosition } from '../../../application/automation/workflows/queries.js';

// The API's opaque page tokens: the last workflow's namespace and name in base64url.
export class CursorMapper {
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
}
