"use client";

import { cn } from "cn";
import { usePathname } from "next/navigation";
import type { Session } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { destinationsOf, isUnder } from "./destinations";
import { useOnCanvas } from "./frame-state";

export function BottomBar({ session }: { readonly session: Session | null }) {
  const pathname = usePathname();
  const canvas = useOnCanvas();

  if (canvas) return null;

  const destinations = destinationsOf(session?.capabilities ?? null);

  return (
    <nav
      aria-label="Destinations"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {destinations.map((destination) => {
          const active = isUnder(pathname, destination.href);
          const Icon = destination.icon;
          return (
            <li key={destination.href} className="flex-1">
              <Link
                href={destination.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium",
                  active ? "text-accent-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {destination.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
