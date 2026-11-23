import { TrailNames } from "@/libs/routing/trail-name";
import { SidebarInset } from "@/libs/ui/components/sidebar";
import { BreadcrumbTrail } from "./breadcrumb-trail";
import { NavigationTrigger } from "./navigation-trigger";

export const CONTENT_ID = "content";

const CONTENT_HREF = `#${CONTENT_ID}`;

interface FrameProps {
  readonly sidebar: React.ReactNode;
  readonly search: React.ReactNode;
  readonly notice: React.ReactNode;
  readonly children: React.ReactNode;
}

export function Frame({ sidebar, search, notice, children }: FrameProps) {
  return (
    <TrailNames>
      <a
        href={CONTENT_HREF}
        className="sr-only z-50 rounded-md bg-background px-3 py-2 font-semibold shadow-overlay focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      {sidebar}
      <SidebarInset className="min-w-0 has-data-[frame=canvas]:h-svh">
        <header className="sticky top-0 z-30 flex h-(--topbar-height) shrink-0 items-center gap-3 border-b bg-background px-4">
          <NavigationTrigger />
          <BreadcrumbTrail />
          {search}
        </header>
        {notice}
        <main
          id={CONTENT_ID}
          tabIndex={-1}
          className="flex min-h-0 min-w-0 flex-1 flex-col outline-none"
        >
          {children}
        </main>
      </SidebarInset>
    </TrailNames>
  );
}
