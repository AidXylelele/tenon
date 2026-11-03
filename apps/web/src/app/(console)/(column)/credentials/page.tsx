import type { Metadata } from 'next';
import { Secrets } from '@/spaces/credentials/modules/secrets';

export const metadata: Metadata = { title: 'Credentials' };

export default function SecretsPage() {
  return <Secrets />;
}
