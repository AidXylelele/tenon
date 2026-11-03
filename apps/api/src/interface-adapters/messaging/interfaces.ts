import type { JsonObject } from '../../domain/automation/json.js';

// What an accepted event's outbox message carries.
export interface AcceptedEventMessage {
  readonly sequence: number;
}

// What a changed schedule's outbox message carries.
export interface ScheduleChangedMessage {
  readonly workflowId: string;
}

export type DeliveryScheme = 'basic' | 'bearer';

// Posts an event in CloudEvents' HTTP structured mode, authenticated with a secret's value (a
// basic one holds `username` and `password`, a bearer one the token or `token`); null when a
// 2xx answered, why not otherwise, never repeating the credential. The address policy refuses
// private destinations (FR-022).
export abstract class DeliveryClient {
  abstract post(
    uri: string,
    scheme: DeliveryScheme | null,
    credential: string | null,
    event: JsonObject,
  ): Promise<string | null>;
}
