import { isObject, type JsonObject } from '@/libs/document-text/json';

// The `document` header of a workflow: what it is called and which version it is.

export interface Header {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
  readonly title: string;
  readonly summary: string;
}

// The header's texts; a part the draft lacks is empty.
export function headerOf(draft: JsonObject): Header {
  const document = isObject(draft.document) ? draft.document : {};
  const text = (key: string) => {
    const value = document[key];
    return typeof value === 'string' ? value : '';
  };
  return {
    namespace: text('namespace'),
    name: text('name'),
    version: text('version'),
    title: text('title'),
    summary: text('summary'),
  };
}
