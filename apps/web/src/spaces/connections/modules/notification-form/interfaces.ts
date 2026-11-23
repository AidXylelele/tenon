import type { RunEvent } from "../../__shared_context/notifications";

export interface SubscriptionEditorProps {
  readonly secretNames: readonly string[];
  readonly presets: readonly RunEvent[];
}

export const ATTRIBUTES = [
  "source",
  "subject",
  "id",
  "datacontenttype",
  "dataschema",
  "data",
] as const;

export type Attribute = (typeof ATTRIBUTES)[number];

export interface AttributeRow {
  readonly id: string;
  readonly attribute: Attribute;
  readonly value: string;
}
