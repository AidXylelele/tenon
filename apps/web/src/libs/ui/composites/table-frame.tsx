export function TableFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card [&_td]:h-10 [&_td]:px-3 [&_th]:px-3 [&_thead_tr]:bg-muted [&_thead_tr]:hover:bg-muted">
      {children}
    </div>
  );
}
