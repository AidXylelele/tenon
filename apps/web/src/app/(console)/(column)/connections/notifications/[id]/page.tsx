import type { Metadata } from 'next';
import { NotificationDetail } from '@/spaces/connections/modules/notification-detail';

export const metadata: Metadata = { title: 'Notification' };

export default async function SubscriptionPage({
  params,
}: PageProps<'/connections/notifications/[id]'>) {
  const { id } = await params;
  return <NotificationDetail id={id} />;
}
