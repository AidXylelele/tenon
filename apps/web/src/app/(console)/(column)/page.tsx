import type { Metadata } from 'next';
import { Overview } from '@/spaces/home/modules/overview';

export const metadata: Metadata = { title: 'Overview' };

export default function OverviewPage() {
  return <Overview />;
}
