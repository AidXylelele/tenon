import type { Metadata } from 'next';
import { InstanceDetail } from '@/spaces/automation/modules/instance-detail';

export const metadata: Metadata = { title: 'Run' };

export default async function InstancePage({
  params,
}: PageProps<'/instances/[id]'>) {
  const { id } = await params;
  return <InstanceDetail id={id} />;
}
