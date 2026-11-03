import { PageBody } from '@/libs/ui/composites/page-body';

export default function ColumnLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <PageBody>{children}</PageBody>;
}
