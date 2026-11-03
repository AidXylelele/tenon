import type { EventFilter } from '@/libs/data-access/types';
import type { JsonValue } from '@/libs/document-text/json';

// A subscription's filter in plain words: "type is com.example.order.paid, source /shop".
export function describeFilter(filter: EventFilter): string {
  return Object.entries(filter.with)
    .map(([attribute, value]) => `${attribute} ${describeValue(value)}`)
    .join(', ');
}

function describeValue(value: JsonValue): string {
  if (typeof value === 'string')
    return value.startsWith('${') ? `where ${value}` : `is ${value}`;

  return `contains ${JSON.stringify(value)}`;
}
