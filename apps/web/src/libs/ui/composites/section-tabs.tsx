'use client';

import { cn } from 'cn';
import { usePathname } from 'next/navigation';
import { Link } from '@/libs/routing/link';

export interface SectionTab {
  readonly href: string;
  readonly label: string;
}

// The tabs of a page made of several pages (Connections, Settings): each tab is an address, so
// it can be shared and the browser's back goes to the previous tab.
export function SectionTabs({
  tabs,
  label,
}: {
  readonly tabs: readonly SectionTab[];
  readonly label: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className="-mx-1 flex gap-1 overflow-x-auto border-b px-1 text-sm"
    >
      {tabs.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2 font-medium whitespace-nowrap transition-colors',
              active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
