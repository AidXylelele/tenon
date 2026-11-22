export function CanvasFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100svh-3.5rem)] min-h-[28rem] min-w-0 flex-col">
      {children}
    </div>
  );
}
