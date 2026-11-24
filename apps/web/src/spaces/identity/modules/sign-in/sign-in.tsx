import { InfoIcon } from "lucide-react";
import type { Query } from "@/libs/routing/segment";
import { Alert, AlertDescription } from "@/libs/ui/components/alert";
import { AuthCard } from "../../__shared_context/auth-card";
import { SignInQuery } from "./query";
import { SignInForm } from "./sign-in-form";

const REASONS = {
  ended: "Your session ended. Sign in to continue where you were.",
  "signed-out": "You signed out.",
  "password-set": "Your password is set. Sign in with it.",
} as const;

export function SignIn({ query }: { readonly query: Query }) {
  const address = SignInQuery.parse(query);
  const notice =
    address.reason === undefined ? undefined : REASONS[address.reason];

  return (
    <AuthCard
      title="Sign in"
      description="Use the email and password of your account."
    >
      <div className="flex flex-col gap-4">
        {notice !== undefined && (
          <Alert>
            <InfoIcon />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        <SignInForm next={address.next} />
      </div>
    </AuthCard>
  );
}
