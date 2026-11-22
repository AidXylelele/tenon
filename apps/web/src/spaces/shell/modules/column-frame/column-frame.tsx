import { PageBody } from "@/libs/ui/composites/page-body";

export function ColumnFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <PageBody>{children}</PageBody>;
}
