import type { Metadata } from 'next';
import { segment } from '@/libs/routing/segment';
import { WorkflowEditor } from '@/spaces/automation/modules/workflow-editor';

export async function generateMetadata({
  params,
}: PageProps<'/workflows/[namespace]/[name]/edit'>): Promise<Metadata> {
  const { name } = await params;
  return { title: `Edit ${segment(name)}` };
}

export default async function EditWorkflowPage({
  params,
}: PageProps<'/workflows/[namespace]/[name]/edit'>) {
  const { namespace, name } = await params;
  return <WorkflowEditor namespace={segment(namespace)} name={segment(name)} />;
}
