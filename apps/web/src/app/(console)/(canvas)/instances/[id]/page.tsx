import type { Metadata } from 'next';
import { RunDetail, type RunPanel } from '@/spaces/runs/modules/run-detail';

export const metadata: Metadata = { title: 'Run' };

export default async function InstancePage({
  params,
  searchParams,
}: PageProps<'/instances/[id]'>) {
  const { id } = await params;
  const { view } = await searchParams;
  return <RunDetail id={id} view={panelOf(view)} />;
}

function panelOf(value: string | string[] | undefined): RunPanel | null {
  const panels: readonly RunPanel[] = ['timeline', 'result', 'input', 'events'];
  return panels.find((panel) => panel === value) ?? null;
}
