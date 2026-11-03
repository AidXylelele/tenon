// The readable column most pages use; canvases take the whole width instead (research R12).
export function PageBody({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      {children}
    </div>
  );
}

// The full width and the height left under the top bar, for a canvas and its panels.
export function CanvasBody({
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
