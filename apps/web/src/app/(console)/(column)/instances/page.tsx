import type { Metadata } from 'next';
import { InstanceList } from '@/spaces/automation/modules/instance-list';

export const metadata: Metadata = { title: 'Runs' };

export default async function InstancesPage({
  searchParams,
}: PageProps<'/instances'>) {
  return <InstanceList query={await searchParams} />;
}
