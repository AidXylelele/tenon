import type { Metadata } from 'next';
import { InvitationAcceptance } from '@/spaces/identity/modules/invitation-acceptance';

export const metadata: Metadata = {
  title: 'Accept the invitation',
  referrer: 'no-referrer',
};

// The emailed link: /invitations/accept?token=… (API, InvitationMail).
export default async function AcceptInvitationPage({
  searchParams,
}: PageProps<'/invitations/accept'>) {
  const { token } = await searchParams;
  const value = Array.isArray(token) ? token[0] : token;
  return <InvitationAcceptance token={value ?? ''} />;
}
