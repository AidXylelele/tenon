import type { Metadata } from 'next';
import { Invitations } from '@/spaces/identity/modules/invitations';

export const metadata: Metadata = { title: 'Invitations' };

export default function TeamPage() {
  return <Invitations />;
}
