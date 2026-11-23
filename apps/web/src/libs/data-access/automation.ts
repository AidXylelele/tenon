import "server-only";
import { ApiError, command, read } from "./http";
import type { Outcome } from "./problem";
import { StructureExtras } from "./structure-extras";
import type {
  CloudEvent,
  CreatedWebhook,
  Endpoint,
  EventFilter,
  HostProfile,
  ImportText,
  CountWindow,
  ExpectedStarts,
  FailingWorkflows,
  FailureWindow,
  Instance,
  InstanceCounts,
  InstanceFilter,
  InstancePage,
  InstanceSummary,
  Page,
  Read,
  Secret,
  Subscription,
  SubscriptionDetail,
  TaskRecord,
  Version,
  VersionStructure,
  Webhook,
  Workflow,
  WorkflowStatus,
} from "./types";
import type { WorkflowStructure } from "language-server/protocol";
import type { JsonObject, JsonValue } from "@/libs/json/json";

const workflowPath = (namespace: string, name: string): string =>
  `/workflows/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;

const versionPath = (namespace: string, name: string, version: string) =>
  `${workflowPath(namespace, name)}/versions/${encodeURIComponent(version)}`;

const instancePath = (id: string): string =>
  `/instances/${encodeURIComponent(id)}`;

export async function workflows(
  status: WorkflowStatus,
  cursor?: string,
  q?: string,
): Promise<Page<Workflow>> {
  const page = await read<Page<Workflow>>("/workflows", {
    query: { status, cursor, q, limit: 50 },
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
  const path = versionPath(namespace, name, version);
  return read(path, { immutable: true });
}

export async function versionStructure(
  namespace: string,
  name: string,
  version: string,
): Promise<VersionStructure | null> {
  const path = `${versionPath(namespace, name, version)}/structure`;
  const structure = await read<WorkflowStructure>(path);

  if (structure === null) return null;

  const extras = StructureExtras.parse(structure);
  return { ...structure, summary: extras.summary, input: extras.input };
}

export async function versionSource(
  namespace: string,
  name: string,
  version: string,
): Promise<string | null> {
  const path = `${versionPath(namespace, name, version)}/source`;
  const found = await read<{ source: string | null }>(path, {
    immutable: true,
  });
  return found?.source ?? null;
}

export function checkDocument(document: JsonObject): Promise<Outcome<void>> {
  return command("/workflows/check", { method: "POST", json: document });
}

export function archiveWorkflow(
  namespace: string,
  name: string,
): Promise<Outcome<void>> {
  return command(`${workflowPath(namespace, name)}/archive`, {
    method: "POST",
  });
}

export function turnWorkflow(
  namespace: string,
  name: string,
  on: boolean,
): Promise<Outcome<void>> {
  const state = on ? "on" : "off";
  return command(`${workflowPath(namespace, name)}/turn-${state}`, {
    method: "POST",
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
    method: "POST",
    json: { version, input },
    headers: { "idempotency-key": idempotencyKey },
  });
}

export async function instances(
  filter: InstanceFilter,
): Promise<Read<InstancePage>> {
  const page = await read<InstancePage>("/instances", {
    query: {
      namespace: filter.namespace,
      name: filter.name,
      version: filter.version,
      phase: filter.phases,
      from: filter.from,
      to: filter.to,
      sort: filter.sort,
      page: filter.page,
      limit: filter.limit,
    },
  });
  return stamped(page ?? { items: [], total: 0, exact: true });
}

export async function instanceCounts(
  window: CountWindow,
): Promise<Read<InstanceCounts>> {
  const counts = await read<InstanceCounts>("/instance-counts", {
    query: {
      bucket: window.buckets,
      to: window.to,
      previousFrom: window.previousFrom,
      namespace: window.namespace,
      name: window.name,
    },
  });

  if (counts === null)
    throw new ApiError(404, "The platform did not count the runs");

  return stamped(counts);
}

export async function failingWorkflows(
  window: FailureWindow,
): Promise<FailingWorkflows> {
  const failing = await read<FailingWorkflows>("/failing-workflows", {
    query: { from: window.from, to: window.to, limit: window.limit },
  });
  return failing ?? { items: [], workflows: 0, failed: 0 };
}

export async function expectedStarts(from: string): Promise<ExpectedStarts[]> {
  const expected = await read<ExpectedStarts[]>("/expected-starts", {
    query: { from },
  });
  return expected ?? [];
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

export type InstanceControl = "suspend" | "resume" | "cancel";

export function controlInstance(
  id: string,
  control: InstanceControl,
): Promise<Outcome<void>> {
  return command(`${instancePath(id)}/${control}`, { method: "POST" });
}

export function restartInstance(id: string): Promise<Outcome<InstanceSummary>> {
  return command(`${instancePath(id)}/restart`, { method: "POST" });
}

export function deleteInstance(id: string): Promise<Outcome<void>> {
  return command(instancePath(id), { method: "DELETE" });
}

export function publishEvent(event: CloudEvent): Promise<Outcome<void>> {
  return command("/events", {
    method: "POST",
    text: JSON.stringify(event),
    contentType: "application/cloudevents+json",
  });
}

export async function webhooks(): Promise<Webhook[]> {
  return (await read<Webhook[]>("/webhooks")) ?? [];
}

export function createWebhook(
  name: string,
  eventType: string,
): Promise<Outcome<CreatedWebhook>> {
  return command("/webhooks", { method: "POST", json: { name, eventType } });
}

export function deleteWebhook(id: string): Promise<Outcome<void>> {
  return command(`/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function fetchImport(uri: string): Promise<Outcome<ImportText>> {
  return command("/imports/fetch", { method: "POST", json: { uri } });
}

export async function hostProfile(): Promise<HostProfile> {
  const profile = await read<HostProfile>("/host-profile");

  if (profile === null)
    throw new ApiError(404, "The platform did not say what it can run");

  return profile;
}

export async function secrets(): Promise<Secret[]> {
  return (await read<Secret[]>("/secrets")) ?? [];
}

export function createSecret(
  name: string,
  value: string,
): Promise<Outcome<Secret>> {
  return command("/secrets", { method: "POST", json: { name, value } });
}

export function replaceSecret(
  name: string,
  value: string,
): Promise<Outcome<void>> {
  return command(`/secrets/${encodeURIComponent(name)}`, {
    method: "PUT",
    json: { value },
  });
}

export function deleteSecret(name: string): Promise<Outcome<void>> {
  return command(`/secrets/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export async function subscriptions(): Promise<Subscription[]> {
  return (await read<Subscription[]>("/subscriptions")) ?? [];
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
  return command("/subscriptions", {
    method: "POST",
    json: { name, endpoint, filter },
  });
}

export function deleteSubscription(id: string): Promise<Outcome<void>> {
  return command(`/subscriptions/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

function stamped<T extends object>(value: T): Read<T> {
  return { ...value, readAt: Date.now() };
}
