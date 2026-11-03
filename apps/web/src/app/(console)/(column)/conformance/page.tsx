import type { Metadata } from 'next';
import { Conformance } from '@/spaces/automation/modules/conformance';

export const metadata: Metadata = { title: 'Supported standard' };

export default function ConformancePage() {
  return <Conformance />;
}
