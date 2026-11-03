import type { Metadata } from 'next';
import { SignIn } from '@/spaces/identity/modules/sign-in';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: PageProps<'/sign-in'>) {
  const { next, reason } = await searchParams;
  return <SignIn next={single(next)} reason={single(reason)} />;
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
