import type { Metadata } from 'next';
import { PasswordRecovery } from '@/spaces/identity/modules/password-recovery';

export const metadata: Metadata = { title: 'Reset your password' };

export default function ForgotPasswordPage() {
  return <PasswordRecovery />;
}
