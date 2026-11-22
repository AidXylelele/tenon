import init, {
  type Diagnostic,
  PositionEncoding,
  Workspace,
} from "@astral-sh/ruff-wasm-web";
import type { Formatting } from "./interfaces";

const SETTINGS = { lint: { select: [] } };

let workspace: Promise<Workspace> | null = null;

export async function formatPython(text: string): Promise<Formatting> {
  const ruff = await ruffWorkspace();

  try {
    const formatted = ruff.format(text);
    return { kind: "formatted", text: formatted };
  } catch (error) {
    const problems: readonly Diagnostic[] = ruff.check(text);
    const [problem] = problems;

    if (problem === undefined) throw error;

    return {
      kind: "refused",
      message: problem.message,
      line: problem.start_location.row,
    };
  }
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
