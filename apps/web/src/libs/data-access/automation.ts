import 'server-only';
import { command, read } from './http';
import type { Outcome } from './problem';
import type {
  CloudEvent,
  ConformanceStatement,
  CreatedWebhook,
  Endpoint,
  EventFilter,
  Instance,
  InstanceFilter,
  InstanceSummary,
  JsonObject,
  JsonValue,
  Page,
  Read,
  Secret,
  Subscription,
  SubscriptionDetail,
  TaskRecord,
  Version,
  Webhook,
  Workflow,
  WorkflowStatus,
} from './types';

// The automation routes of feature 002, one function per route.

const workflowPath = (namespace: string, name: string): string =>
  `/workflows/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;

const instancePath = (id: string): string =>
  `/instances/${encodeURIComponent(id)}`;

export async function workflows(
  status: WorkflowStatus,
  cursor?: string,
): Promise<Page<Workflow>> {
  const page = await read<Page<Workflow>>('/workflows', {
    query: { status, cursor, limit: 50 },
  });
  return page ?? { items: [], next: null };
}

export function workflow(
  namespace: string,
  name: string,
): Promise<Workflow | null> {
  return read(workflowPath(namespace, name));
}

export async function versions(
  namespace: string,
  name: string,
): Promise<Version[]> {
  return (
    (await read<Version[]>(`${workflowPath(namespace, name)}/versions`)) ?? []
  );
}

export function versionDocument(
  namespace: string,
  name: string,
  version: string,
): Promise<JsonObject | null> {
  const path = `${workflowPath(namespace, name)}/versions/${encodeURIComponent(version)}`;
  return read(path);
}

export function checkDocument(document: JsonObject): Promise<Outcome<void>> {
  return command('/workflows/check', { method: 'POST', json: document });
}

export function publishDocument(
  document: JsonObject,
): Promise<Outcome<Version>> {
  return command('/workflows', { method: 'POST', json: document });
}

export function archiveWorkflow(
  namespace: string,
  name: string,
): Promise<Outcome<void>> {
  return command(`${workflowPath(namespace, name)}/archive`, {
    method: 'POST',
  });
}

export function turnWorkflow(
  namespace: string,
  name: string,
  on: boolean,
): Promise<Outcome<void>> {
  const state = on ? 'on' : 'off';
  return command(`${workflowPath(namespace, name)}/turn-${state}`, {
    method: 'POST',
  });
}

export function startInstance(
  namespace: string,
  name: string,
  version: string,
  input: JsonValue,
  idempotencyKey: string,
): Promise<Outcome<InstanceSummary>> {
  return command(`${workflowPath(namespace, name)}/instances`, {
    method: 'POST',
    json: { version, input },
    headers: { 'idempotency-key': idempotencyKey },
  });
}

export async function instances(
  filter: InstanceFilter,
): Promise<Read<Page<InstanceSummary>>> {
  const page = await read<Page<InstanceSummary>>('/instances', {
    query: { ...filter },
  });
  return stamped(page ?? { items: [], next: null });
}

export function instance(id: string): Promise<Instance | null> {
  return read(instancePath(id));
}

export async function taskRecords(
  id: string,
  cursor?: number,
): Promise<Read<Page<TaskRecord>>> {
  const page = await read<Page<TaskRecord>>(`${instancePath(id)}/tasks`, {
    query: { cursor, limit: 500 },
  });
  return stamped(page ?? { items: [], next: null });
}

export async function instanceEvents(
  id: string,
  cursor?: number,
): Promise<Page<CloudEvent>> {
  const page = await read<Page<CloudEvent>>(`${instancePath(id)}/events`, {
    query: { cursor, limit: 500 },
  });
  return page ?? { items: [], next: null };
}

export type InstanceControl = 'suspend' | 'resume' | 'cancel';

export function controlInstance(
  id: string,
  control: InstanceControl,
): Promise<Outcome<void>> {
  return command(`${instancePath(id)}/${control}`, { method: 'POST' });
}

export function restartInstance(id: string): Promise<Outcome<InstanceSummary>> {
  return command(`${instancePath(id)}/restart`, { method: 'POST' });
}

export function deleteInstance(id: string): Promise<Outcome<void>> {
  return command(instancePath(id), { method: 'DELETE' });
}

export function publishEvent(event: CloudEvent): Promise<Outcome<void>> {
  return command('/events', {
    method: 'POST',
    text: JSON.stringify(event),
    contentType: 'application/cloudevents+json',
  });
}

export async function webhooks(): Promise<Webhook[]> {
  return (await read<Webhook[]>('/webhooks')) ?? [];
}

export function createWebhook(
  name: string,
  eventType: string,
): Promise<Outcome<CreatedWebhook>> {
  return command('/webhooks', { method: 'POST', json: { name, eventType } });
}

export function deleteWebhook(id: string): Promise<Outcome<void>> {
  return command(`/webhooks/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function secrets(): Promise<Secret[]> {
  return (await read<Secret[]>('/secrets')) ?? [];
}

export function createSecret(
  name: string,
  value: string,
): Promise<Outcome<Secret>> {
  return command('/secrets', { method: 'POST', json: { name, value } });
}

export function replaceSecret(
  name: string,
  value: string,
): Promise<Outcome<void>> {
  return command(`/secrets/${encodeURIComponent(name)}`, {
    method: 'PUT',
    json: { value },
  });
}

export function deleteSecret(name: string): Promise<Outcome<void>> {
  return command(`/secrets/${encodeURIComponent(name)}`, { method: 'DELETE' });
}

export async function subscriptions(): Promise<Subscription[]> {
  return (await read<Subscription[]>('/subscriptions')) ?? [];
}

export async function subscription(
  id: string,
): Promise<Read<SubscriptionDetail> | null> {
  const detail = await read<SubscriptionDetail>(
    `/subscriptions/${encodeURIComponent(id)}`,
  );
  return detail === null ? null : stamped(detail);
}

export function createSubscription(
  name: string,
  endpoint: Endpoint,
  filter: EventFilter,
): Promise<Outcome<Subscription>> {
  return command('/subscriptions', {
    method: 'POST',
    json: { name, endpoint, filter },
  });
}

export function deleteSubscription(id: string): Promise<Outcome<void>> {
  return command(`/subscriptions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function conformance(): Promise<ConformanceStatement> {
  const statement = await read<ConformanceStatement>('/conformance');

  if (statement === null) throw new Error('The API states no conformance');

  return statement;
}

function stamped<T extends object>(value: T): Read<T> {
  return { ...value, readAt: Date.now() };
}
