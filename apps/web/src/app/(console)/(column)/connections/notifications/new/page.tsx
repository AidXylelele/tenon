import type { Metadata } from 'next';
import { NotificationForm } from '@/spaces/connections/modules/notification-form';

export const metadata: Metadata = { title: 'New notification' };

export default function NewSubscriptionPage() {
  return <NotificationForm />;
}
