import type { Metadata } from 'next';
import { connection } from 'next/server';
import { PasswordRecovery } from '@/spaces/identity/modules/password-recovery';

export const metadata: Metadata = { title: 'Reset your password' };

// Rendered per request, so its scripts carry the request's CSP nonce (docs, Content Security
// Policy: every page is dynamic).
export default async function ForgotPasswordPage() {
  await connection();
  return <PasswordRecovery />;
}
