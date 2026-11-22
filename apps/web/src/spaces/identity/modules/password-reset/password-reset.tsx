import Link from "next/link";
import { FORGOT_PASSWORD_HREF } from "@/libs/routing/routes";
import type { Query } from "@/libs/routing/segment";
import { AuthCard } from "../../__shared_context/auth-card";
import { NewPasswordForm } from "./new-password-form";
import { ResetQuery } from "./query";

export function PasswordReset({ query }: { readonly query: Query }) {
  const address = ResetQuery.parse(query);
  const again = (
    <Link
      href={FORGOT_PASSWORD_HREF}
      className="underline-offset-4 hover:underline"
    >
      Ask for a new link
    </Link>
  );

  if (address.token === "")
    return (
      <AuthCard
        title="This link is incomplete"
        description="Open the link from the email as it is, or ask for a new one."
        footer={again}
      >
        <p className="text-sm text-muted-foreground">
          No token was found in the address.
        </p>
      </AuthCard>
    );

  return (
    <AuthCard
      title="Choose a new password"
      description="Every session of your account ends, and you sign in with the new password."
      footer={again}
    >
      <NewPasswordForm token={address.token} />
    </AuthCard>
  );
}
