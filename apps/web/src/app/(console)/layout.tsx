import { ConsoleFrame } from '@/spaces/shell/modules/console-frame';

export default function ConsoleLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <ConsoleFrame>{children}</ConsoleFrame>;
}
