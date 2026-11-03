import type { Metadata } from 'next';
import { Webhooks } from '@/spaces/automation/modules/webhooks';

export const metadata: Metadata = { title: 'Webhooks' };

export default function WebhooksPage() {
  return <Webhooks />;
}
