import Link from 'next/link';
import { verifyInvitation } from '@/libs/data-access/identity';
import { SIGN_IN_HREF } from '@/operations/app-routes';
import { AuthCard } from '../../__shared_context/auth-card';
import { InvitationForm } from './invitation-form';

const ROLE: Record<string, string> = {
  admin: 'an administrator',
  editor: 'an editor',
  viewer: 'a viewer',
};

// Checks the link first, so a used or expired invitation says so before anything is typed.
export async function InvitationAcceptance({
  token,
}: {
  readonly token: string;
}) {
  const signIn = (
    <Link href={SIGN_IN_HREF} className="underline-offset-4 hover:underline">
      Already have an account? Sign in
    </Link>
  );
  const verified = token === '' ? null : await verifyInvitation(token);

  if (verified === null || !verified.ok)
    return (
      <AuthCard
        title="This invitation cannot be used"
        description={
          verified?.ok === false
            ? verified.problem.detail
            : 'The link is incomplete. Open it from the email as it is.'
        }
        footer={signIn}
      >
        <p className="text-sm text-muted-foreground">
          Invitations work once and expire. Ask the administrator who invited
          you to send a new one.
        </p>
      </AuthCard>
    );

  const role = ROLE[verified.value.role] ?? verified.value.role;

  return (
    <AuthCard
      title="Join the team"
      description={`You are invited as ${role}. Choose your name and password.`}
      footer={signIn}
    >
      <InvitationForm token={token} email={verified.value.email} />
    </AuthCard>
  );
}
