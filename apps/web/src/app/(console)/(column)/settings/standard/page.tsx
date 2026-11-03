import type { Metadata } from 'next';
import { Standard } from '@/spaces/settings/modules/standard';

export const metadata: Metadata = { title: 'Supported standard' };

export default function ConformancePage() {
  return <Standard />;
}
