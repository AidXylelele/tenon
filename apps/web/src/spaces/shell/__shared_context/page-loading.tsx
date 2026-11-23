import { cn } from "@/libs/ui/tokens/cn";

export function PageLoading({
  className,
  children,
}: {
  readonly className: string;
  readonly children: React.ReactNode;
}) {
  const shownAfterASecond = cn(
    "animate-in fill-mode-both delay-1000 duration-(--duration-fast) fade-in",
    className,
  );

  return (
    <div role="status" className={shownAfterASecond}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}
