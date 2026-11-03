import type { Metadata } from 'next';
import { PasswordReset } from '@/spaces/identity/modules/password-reset';

export const metadata: Metadata = {
  title: 'Choose a new password',
  referrer: 'no-referrer',
};

// The emailed link: /reset-password?token=… (API, passwordReset.url).
export default async function ResetPasswordPage({
  searchParams,
}: PageProps<'/reset-password'>) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  return <PasswordReset token={value ?? ''} />;
}
