export interface CursorPosition {
  readonly at: Date;
  readonly id: string;
}

export class PageCursor {
  static encode(position: CursorPosition): string {
    const at = position.at.toISOString();
    const text = JSON.stringify({ at, id: position.id });
    return Buffer.from(text).toString('base64url');
  }

  static decode(cursor: string | null): CursorPosition | null {
    if (cursor === null) return null;

    try {
      const text = Buffer.from(cursor, 'base64url').toString('utf8');
      const value = JSON.parse(text) as { at?: unknown; id?: unknown };

      if (typeof value.at !== 'string' || typeof value.id !== 'string') {
        return null;
      }

      return { at: new Date(value.at), id: value.id };
    } catch {
      return null;
    }
  }
}
