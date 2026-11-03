import type { Metadata } from 'next';
import { SubscriptionForm } from '@/spaces/automation/modules/subscription-form';

export const metadata: Metadata = { title: 'New subscription' };

export default function NewSubscriptionPage() {
  return <SubscriptionForm />;
}
