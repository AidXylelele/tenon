import type { Metadata } from 'next';
import { SubscriptionList } from '@/spaces/automation/modules/subscription-list';

export const metadata: Metadata = { title: 'Notifications' };

export default function SubscriptionsPage() {
  return <SubscriptionList />;
}
