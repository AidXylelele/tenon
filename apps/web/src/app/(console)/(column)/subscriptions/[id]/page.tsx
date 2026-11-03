import type { Metadata } from 'next';
import { SubscriptionDetail } from '@/spaces/automation/modules/subscription-detail';

export const metadata: Metadata = { title: 'Subscription' };

export default async function SubscriptionPage({
  params,
}: PageProps<'/subscriptions/[id]'>) {
  const { id } = await params;
  return <SubscriptionDetail id={id} />;
}
