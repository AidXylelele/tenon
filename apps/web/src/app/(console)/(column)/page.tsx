import type { Metadata } from 'next';
import { Overview } from '@/spaces/automation/modules/overview';

export const metadata: Metadata = { title: 'Overview' };

export default function OverviewPage() {
  return <Overview />;
}
