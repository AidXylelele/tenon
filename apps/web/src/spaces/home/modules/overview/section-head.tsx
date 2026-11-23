import { ChevronRightIcon } from "lucide-react";
import { Link } from "@/libs/routing/link";

export function SectionHead({
  id,
  title,
  more,
}: {
  readonly id: string;
  readonly title: string;
  readonly more: { readonly href: string; readonly label: string } | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
      <h2 id={id} className="heading-3">
        {title}
      </h2>
      {more !== null && (
        <Link
          href={more.href}
          className="flex items-center gap-0.5 text-sm text-accent-text underline-offset-4 hover:underline"
        >
          {more.label}
          <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}
