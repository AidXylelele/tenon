import type { Metadata } from 'next';
import { Secrets } from '@/spaces/automation/modules/secrets';

export const metadata: Metadata = { title: 'Secrets' };

export default function SecretsPage() {
  return <Secrets />;
}
