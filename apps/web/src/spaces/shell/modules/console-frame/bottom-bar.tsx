'use client';

import { cn } from 'cn';
import { usePathname } from 'next/navigation';
import type { Role } from '@/libs/data-access/types';
import { Link } from '@/libs/routing/link';
import { destinationsOf, isUnder } from './destinations';
import { useOnCanvas } from './frame-state';

// The destinations at the bottom of a phone's screen, as native apps keep them (research R15).
// A canvas needs the height, so it hides the bar, as a pushed screen does.
export function BottomBar({ role }: { readonly role: Role | null }) {
  const pathname = usePathname();
  const canvas = useOnCanvas();

  if (canvas) return null;

  const destinations = destinationsOf(role);

  return (
    <nav
      aria-label="Destinations"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
    >
      <ul className="flex">
        {destinations.map((destination) => {
          const active = isUnder(pathname, destination.href);
          const Icon = destination.icon;
          return (
            <li key={destination.href} className="flex-1">
              <Link
                href={destination.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
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
