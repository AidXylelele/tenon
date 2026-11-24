import type { Analysis } from "interpreter/front-end";
import { workflowStructureOf } from "./ide/structure/index.js";
import { lspWorkflowOf } from "./lsp/positions.js";
import type { WorkflowStructure } from "./protocol/index.js";

export type { WorkflowStructure } from "./protocol/index.js";

export function structureOf(analysis: Analysis): WorkflowStructure | null {
  switch (analysis.kind) {
    case "analyzed": {
      const workflow = workflowStructureOf(analysis.model, null);
      return lspWorkflowOf(workflow);
    }
    case "refused":
      return null;
  }
}
