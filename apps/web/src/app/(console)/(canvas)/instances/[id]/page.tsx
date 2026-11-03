import type { Metadata } from 'next';
import {
  InstanceDetail,
  type RunPanel,
} from '@/spaces/automation/modules/instance-detail';

export const metadata: Metadata = { title: 'Run' };

export default async function InstancePage({
  params,
  searchParams,
}: PageProps<'/instances/[id]'>) {
  const { id } = await params;
  const { view } = await searchParams;
  return <InstanceDetail id={id} view={panelOf(view)} />;
}

function panelOf(value: string | string[] | undefined): RunPanel | null {
  const panels: readonly RunPanel[] = ['timeline', 'result', 'input', 'events'];
  return panels.find((panel) => panel === value) ?? null;
}
