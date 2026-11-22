import type { Metadata } from "next";
import { WorkflowList } from "@/spaces/workflows/modules/workflow-list";

export const metadata: Metadata = { title: "Workflows" };

export default async function WorkflowsPage({
  searchParams,
}: PageProps<"/workflows">) {
  return <WorkflowList query={await searchParams} />;
}
