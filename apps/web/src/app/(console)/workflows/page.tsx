import type { Metadata } from 'next';
import { WorkflowList } from '@/spaces/automation/modules/workflow-list';

export const metadata: Metadata = { title: 'Workflows' };

export default async function WorkflowsPage({
  searchParams,
}: PageProps<'/workflows'>) {
  const { status, cursor } = await searchParams;
  const archived = status === 'archived';
  return (
    <WorkflowList
      status={archived ? 'archived' : 'active'}
      cursor={typeof cursor === 'string' ? cursor : undefined}
    />
  );
}
