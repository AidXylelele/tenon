import type { Metadata } from "next";
import {
  WorkflowDetail,
  workflowMetadata,
} from "@/spaces/workflows/modules/workflow-detail";

export async function generateMetadata({
  params,
}: PageProps<"/workflows/[namespace]/[name]">): Promise<Metadata> {
  return workflowMetadata(await params);
}

export default async function WorkflowPage({
  params,
  searchParams,
}: PageProps<"/workflows/[namespace]/[name]">) {
  return <WorkflowDetail params={await params} query={await searchParams} />;
}
