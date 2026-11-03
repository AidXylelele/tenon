import type { Metadata } from 'next';
import { segment } from '@/libs/routing/segment';
import { WorkflowDetail } from '@/spaces/automation/modules/workflow-detail';

export async function generateMetadata({
  params,
}: PageProps<'/workflows/[namespace]/[name]'>): Promise<Metadata> {
  const { name } = await params;
  return { title: segment(name) };
}

export default async function WorkflowPage({
  params,
  searchParams,
}: PageProps<'/workflows/[namespace]/[name]'>) {
  const { namespace, name } = await params;
  const { start } = await searchParams;
  return (
    <WorkflowDetail
      namespace={segment(namespace)}
      name={segment(name)}
      starting={start === '1'}
    />
  );
}
