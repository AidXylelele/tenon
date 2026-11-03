import { AuthFrame } from '@/spaces/shell/modules/auth-frame';

export default function AnonymousLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <AuthFrame>{children}</AuthFrame>;
}
