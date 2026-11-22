import type { Metadata } from "next";
import { PasswordReset } from "@/spaces/identity/modules/password-reset";

export const metadata: Metadata = {
  title: "Reset password",
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  return <PasswordReset query={await searchParams} />;
}
