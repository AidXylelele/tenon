export function AuthLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-muted px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-8">{children}</div>
    </main>
  );
}
