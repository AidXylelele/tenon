import { ConnectionsFrame } from "@/spaces/connections/modules/connections-frame";

export default function ConnectionsLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <ConnectionsFrame>{children}</ConnectionsFrame>;
}
