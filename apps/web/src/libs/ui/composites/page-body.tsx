export function PageBody({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-(--page-width-max) min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8 xl:px-8">
      {children}
    </div>
  );
}
