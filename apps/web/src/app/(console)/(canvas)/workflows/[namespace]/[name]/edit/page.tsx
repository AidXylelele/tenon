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
  searchParams,
}: PageProps<'/workflows/[namespace]/[name]/edit'>) {
  const { namespace, name } = await params;
  const { step } = await searchParams;
  const opened = stepOf(step);
  return (
    <WorkflowEditor
      namespace={segment(namespace)}
      name={segment(name)}
      step={opened}
    />
  );
}

function stepOf(value: string | string[] | undefined): string | null {
  return typeof value === 'string' ? value : null;
}
