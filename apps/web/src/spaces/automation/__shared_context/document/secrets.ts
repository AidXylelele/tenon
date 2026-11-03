import {
  isObject,
  type JsonObject,
  type JsonValue,
  valueAt,
  withValue,
} from '@/libs/document-text/json';

// The secrets a draft's calls authenticate with (`basic` or `bearer` with `use`), declared in
// `use.secrets` as the check requires (002 US8 scenario 4).

export function secretsUsed(draft: JsonObject): string[] {
  const names = new Set<string>();
  collect(draft, names);
  return [...names];
}

export function withDeclaredSecrets(draft: JsonObject): JsonObject {
  const declared = valueAt(draft, '/use/secrets');
  const known = Array.isArray(declared)
    ? declared.filter((name) => typeof name === 'string')
    : [];
  const missing = secretsUsed(draft).filter((name) => !known.includes(name));

  if (missing.length === 0) return draft;

  return withValue(draft, '/use/secrets', [...known, ...missing]);
}

function collect(value: JsonValue, names: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collect(item, names));
    return;
  }

  if (!isObject(value)) return;

  for (const scheme of ['basic', 'bearer'] as const) {
    const policy = value[scheme];

    if (isObject(policy) && typeof policy.use === 'string' && policy.use !== '')
      names.add(policy.use);
  }

  Object.values(value).forEach((item) => collect(item, names));
}
