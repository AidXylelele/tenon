import Link from "next/link";
import type { InvitationPreview } from "@/libs/data-access/types";
import { SIGN_IN_HREF } from "@/libs/routing/routes";
import { roleNoun } from "@/operations/roles";
import { AuthCard } from "../../__shared_context/auth-card";
import { InvitationForm } from "./invitation-form";

export type InvitationCheck =
  | {
      readonly kind: "valid";
      readonly token: string;
      readonly invitation: InvitationPreview;
    }
  | { readonly kind: "refused"; readonly reason: string };

export function InvitationAcceptancePage({
  check,
}: {
  readonly check: InvitationCheck;
}) {
  const signIn = (
    <Link href={SIGN_IN_HREF} className="underline-offset-4 hover:underline">
      Already have an account? Sign in
    </Link>
  );

  if (check.kind === "refused")
    return (
      <AuthCard
        title="This invitation cannot be used"
        description={check.reason}
        footer={signIn}
      >
        <p className="text-body text-muted-foreground">
          Invitations work once and expire. Ask the administrator who invited
          you to send a new one.
        </p>
      </AuthCard>
    );

  const role = roleNoun(check.invitation.role);
  const description = `You are invited as ${role}. Choose your name and password.`;

  return (
    <AuthCard title="Join the team" description={description} footer={signIn}>
      <InvitationForm token={check.token} email={check.invitation.email} />
    </AuthCard>
  );
}
