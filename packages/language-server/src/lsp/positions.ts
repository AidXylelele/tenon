import type { Position, Range } from "interpreter/front-end";
import type * as lsp from "vscode-languageserver/browser";
import type {
  NestedList,
  Step,
  StepList,
  WorkflowStructure,
} from "../ide/structure/index.js";
import type { TextChange } from "../ide/text/index.js";
import type * as protocol from "../protocol/index.js";

export function lspRangeOf(range: Range): lsp.Range {
  const start = lspPositionOf(range.start);
  const end = lspPositionOf(range.end);

  return { start, end };
}

export function lspPlacementOf(range: Range | null): lsp.Range | null {
  if (range === null) {
    return null;
  }

  return lspRangeOf(range);
}

export function lspWorkflowOf(
  workflow: WorkflowStructure,
): protocol.WorkflowStructure {
  const steps = lspStepListOf(workflow.steps);

  return { ...workflow, steps };
}

export function textEditOf(change: TextChange): lsp.TextEdit {
  const range = lspRangeOf(change.range);

  return { range, newText: change.text };
}

export function ideRangeOf(range: lsp.Range): Range {
  const start = positionOf(range.start);
  const end = positionOf(range.end);

  return { start, end };
}

export function positionOf(position: lsp.Position): Position {
  return { line: position.line + 1, column: position.character + 1 };
}

function lspStepListOf(list: StepList): protocol.StepList {
  const steps = list.steps.map(lspStepOf);

  return { ...list, steps };
}

function lspNestedListOf(list: NestedList): protocol.NestedList {
  const steps = list.steps.map(lspStepOf);

  return { ...list, steps };
}

function lspStepOf(step: Step): protocol.Step {
  const range = lspPlacementOf(step.range);
  const selectionRange = lspPlacementOf(step.selectionRange);
  const lists = step.lists.map(lspNestedListOf);

  return { ...step, range, selectionRange, lists };
}

function lspPositionOf(position: Position): lsp.Position {
  return { line: position.line - 1, character: position.column - 1 };
}
