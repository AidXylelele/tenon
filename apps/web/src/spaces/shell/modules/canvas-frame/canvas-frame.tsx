export function CanvasFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div
      data-frame="canvas"
      className="flex min-h-[28rem] min-w-0 flex-1 flex-col"
    >
      {children}
    </div>
  );
}
