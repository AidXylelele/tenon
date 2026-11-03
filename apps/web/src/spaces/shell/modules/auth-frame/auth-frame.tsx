import { BrandMark, PRODUCT_NAME } from '../../__shared_context/brand-mark';

// The frame of the pages reached without a session: the mark and one narrow column.
export function AuthFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center text-sm font-medium">
          <BrandMark />
          {PRODUCT_NAME}
        </div>
        {children}
      </div>
    </div>
  );
}
