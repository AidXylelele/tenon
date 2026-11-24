import type { WorkflowName } from "../../../domain/automation/workflows/workflow-name.js";
import type { DraftView } from "./interfaces.js";

export abstract class DraftQueries {
  abstract find(name: WorkflowName): Promise<DraftView | null>;
}
