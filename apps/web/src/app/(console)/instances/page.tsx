import type { Metadata } from 'next';
import type { InstanceFilter, Phase } from '@/libs/data-access/types';
import { InstanceList } from '@/spaces/automation/modules/instance-list';

export const metadata: Metadata = { title: 'Runs' };

const PHASES: readonly Phase[] = [
  'pending',
  'running',
  'waiting',
  'suspended',
  'cancelled',
  'faulted',
  'completed',
];

export default async function InstancesPage({
  searchParams,
}: PageProps<'/instances'>) {
  const query = await searchParams;
  const text = (key: string) =>
    typeof query[key] === 'string' && query[key] !== ''
      ? query[key]
      : undefined;
  const phase = PHASES.find((each) => each === text('phase'));
  const filter: InstanceFilter = {
    namespace: text('namespace'),
    name: text('name'),
    version: text('version'),
    phase,
    startedFrom: text('startedFrom'),
    startedTo: text('startedTo'),
    cursor: text('cursor'),
  };
  return <InstanceList filter={filter} />;
}
