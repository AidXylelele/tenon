import { workflowSearch } from "@/spaces/shell/modules/console-frame";

export function GET(): Promise<Response> {
  return workflowSearch();
}
