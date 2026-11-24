export type JsonValue =
  null | boolean | number | string | JsonArray | JsonObject;

export type JsonArray = readonly JsonValue[];

export interface JsonObject {
  readonly [key: string]: JsonValue;
}
