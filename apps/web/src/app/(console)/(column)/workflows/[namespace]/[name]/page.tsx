import type { Metadata } from 'next';
import { segment } from '@/libs/routing/segment';
import {
  WorkflowDetail,
  type WorkflowTab,
} from '@/spaces/workflows/modules/workflow-detail';

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
  const { start, tab } = await searchParams;
  return (
    <WorkflowDetail
      namespace={segment(namespace)}
      name={segment(name)}
      tab={tabOf(tab)}
      starting={start === '1'}
    />
  );
}

function tabOf(value: string | string[] | undefined): WorkflowTab {
  return value === 'runs' || value === 'versions' ? value : 'overview';
}
