"use client";

import { cn } from "cn";
import { usePathname } from "next/navigation";
import { Link } from "@/libs/routing/link";

interface RouteTab {
  readonly href: string;
  readonly label: React.ReactNode;
  readonly current?: boolean;
}

export function RouteTabs({
  tabs,
  label,
}: {
  readonly tabs: readonly RouteTab[];
  readonly label: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className="-mx-1 flex gap-1 overflow-x-auto border-b px-1 text-sm"
    >
      {tabs.map((tab) => {
        const under =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        const active = tab.current ?? under;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 font-medium whitespace-nowrap transition-colors duration-(--duration-fast)",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
