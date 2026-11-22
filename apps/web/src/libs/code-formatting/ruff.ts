import init, {
  type Diagnostic,
  PositionEncoding,
  Workspace,
} from "@astral-sh/ruff-wasm-web";
import type { CodeProblem } from "@/libs/codemirror/interfaces";
import type { Formatted, Refused } from "./interfaces";
import { keptCursor, lineWithin } from "./positions";

const SETTINGS = { lint: { select: [] } };

let workspace: Promise<Workspace> | null = null;

export async function formatPython(
  text: string,
  cursor: number,
): Promise<Formatted | Refused> {
  const ruff = await ruffWorkspace();

  try {
    const formatted = ruff.format(text);
    const kept = keptCursor(text, formatted, cursor);
    return { kind: "formatted", text: formatted, cursor: kept };
  } catch (error) {
    const [problem] = problemsOf(ruff, text);

    if (problem === undefined) throw error;

    return { kind: "refused", message: problem.message, line: problem.line };
  }
}

export async function checkPython(
  text: string,
): Promise<readonly CodeProblem[]> {
  const ruff = await ruffWorkspace();
  return problemsOf(ruff, text);
}

function problemsOf(ruff: Workspace, text: string): readonly CodeProblem[] {
  const diagnostics: readonly Diagnostic[] = ruff.check(text);
  return diagnostics.map((diagnostic) => {
    const line = lineWithin(text, diagnostic.start_location.row);
    return { line, message: diagnostic.message, severity: "error" };
  });
}

function ruffWorkspace(): Promise<Workspace> {
  workspace ??= load();
  return workspace;
}

async function load(): Promise<Workspace> {
  try {
    await init();
  } catch (error) {
    workspace = null;
    throw error;
  }

  return new Workspace(SETTINGS, PositionEncoding.Utf16);
}
