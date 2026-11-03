import type { Metadata } from 'next';
import { NotificationList } from '@/spaces/connections/modules/notification-list';

export const metadata: Metadata = { title: 'Notifications' };

export default function SubscriptionsPage() {
  return <NotificationList />;
}
