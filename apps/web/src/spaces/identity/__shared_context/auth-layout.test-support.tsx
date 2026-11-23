import { AuthFrame } from "@/spaces/shell/modules/auth-frame";

export function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <AuthFrame>{children}</AuthFrame>;
}
