import type { Metadata } from 'next';
import { Account } from '@/spaces/identity/modules/account';

export const metadata: Metadata = { title: 'Account' };

export default function AccountPage() {
  return <Account />;
}
