// The console's addresses of automation resources.

export function workflowHref(namespace: string, name: string): string {
  return `/workflows/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`;
}

export function versionHref(
  namespace: string,
  name: string,
  version: string,
): string {
  return `${workflowHref(namespace, name)}/versions/${encodeURIComponent(version)}`;
}

export function instanceHref(id: string): string {
  return `/instances/${encodeURIComponent(id)}`;
}
