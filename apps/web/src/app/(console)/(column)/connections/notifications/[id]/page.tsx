import type { Metadata } from 'next';
import { SubscriptionDetail } from '@/spaces/automation/modules/subscription-detail';

export const metadata: Metadata = { title: 'Notification' };

export default async function SubscriptionPage({
  params,
}: PageProps<'/connections/notifications/[id]'>) {
  const { id } = await params;
  return <SubscriptionDetail id={id} />;
}
