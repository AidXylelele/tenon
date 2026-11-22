export function PageBody({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-6 px-4 pt-6 pb-24 md:px-8 md:py-8">
      {children}
    </div>
  );
}
