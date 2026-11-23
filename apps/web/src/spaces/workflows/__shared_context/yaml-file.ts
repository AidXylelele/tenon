export interface YamlFile {
  readonly href: string;
  readonly name: string;
}

export function yamlFileOf(
  name: string,
  version: string | null,
  source: string | null,
): YamlFile | null {
  if (version === null || source === null) return null;

  const text = encodeURIComponent(source);
  const href = `data:application/yaml;charset=utf-8,${text}`;
  const file = `${name}-${version}.yaml`;
  return { href, name: file };
}
