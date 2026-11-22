import type { Metadata } from "next";
import {
  editorMetadata,
  WorkflowEditor,
} from "@/spaces/workflows/modules/workflow-editor";

export async function generateMetadata({
  params,
}: PageProps<"/workflows/[namespace]/[name]/edit">): Promise<Metadata> {
  return editorMetadata(await params);
}

export default async function EditWorkflowPage({
  params,
  searchParams,
}: PageProps<"/workflows/[namespace]/[name]/edit">) {
  return <WorkflowEditor params={await params} query={await searchParams} />;
}
