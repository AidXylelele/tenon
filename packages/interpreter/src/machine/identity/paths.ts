export type Path =
  | RootPath
  | TaskPath
  | IterationPath
  | AttemptPath
  | ExtensionPath
  | ProcedurePath;

export type PathOf<Kind extends Path["kind"]> = Extract<Path, { kind: Kind }>;

export type ExtensionSide = "before" | "after";

interface RootPath {
  readonly kind: "root";
}

interface TaskPath {
  readonly kind: "task";
  readonly outer: Path;
  readonly reference: string;
  readonly visit: number;
}

interface IterationPath {
  readonly kind: "iteration";
  readonly outer: Path;
  readonly index: number;
}

interface AttemptPath {
  readonly kind: "attempt";
  readonly outer: Path;
  readonly number: number;
}

interface ExtensionPath {
  readonly kind: "extension";
  readonly outer: Path;
  readonly side: ExtensionSide;
  readonly index: number;
  readonly pointer: string;
}

interface ProcedurePath {
  readonly kind: "procedure";
  readonly outer: Path;
  readonly reference: string;
}

export const rootPath: Path = { kind: "root" };

export function taskPathOf(path: Path, reference: string, visit: number): Path {
  return { kind: "task", outer: path, reference, visit };
}

export function iterationPathOf(path: Path, index: number): Path {
  return { kind: "iteration", outer: path, index };
}

export function attemptPathOf(path: Path, attempt: number): Path {
  if (attempt === 1) {
    return path;
  }

  return { kind: "attempt", outer: path, number: attempt };
}

export function extensionPathOf(
  path: Path,
  side: ExtensionSide,
  extension: { readonly index: number; readonly pointer: string },
): Path {
  return {
    kind: "extension",
    outer: path,
    side,
    index: extension.index,
    pointer: extension.pointer,
  };
}

export function procedurePathOf(path: Path, reference: string): Path {
  return { kind: "procedure", outer: path, reference };
}
