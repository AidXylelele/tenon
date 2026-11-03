import type { JsonObject } from '../../domain/automation/json.js';

// The header a delivery authenticates with, or none.
export interface DeliveryAuthorization {
  readonly scheme: 'Basic' | 'Bearer';
  readonly parameter: string;
}

// Posts an event in CloudEvents' HTTP structured mode; null when a 2xx answered, why not
// otherwise. The address policy refuses private destinations (FR-022).
export abstract class DeliveryClient {
  abstract post(
    uri: string,
    authorization: DeliveryAuthorization | null,
    event: JsonObject,
  ): Promise<string | null>;
}
