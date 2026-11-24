import { CanvasFrame } from "@/spaces/shell/modules/canvas-frame";

export default function CanvasLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return <CanvasFrame>{children}</CanvasFrame>;
}
