import { CanvasBody } from '@/libs/ui/composites/page-body';

export default function CanvasLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <CanvasBody>{children}</CanvasBody>;
}
