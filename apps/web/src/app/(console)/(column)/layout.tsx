import { ColumnFrame } from "@/spaces/shell/modules/column-frame";

export default function ColumnLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <ColumnFrame>{children}</ColumnFrame>;
}
