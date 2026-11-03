import { PlusIcon } from 'lucide-react';
import { Link } from '@/libs/routing/link';
import { Suspense } from 'react';
import { currentUser } from '@/libs/data-access/identity';
import { Button } from '@/libs/ui/components/button';
import { Separator } from '@/libs/ui/components/separator';
import { SidebarInset, SidebarTrigger } from '@/libs/ui/components/sidebar';
import { BottomBar } from './bottom-bar';
import { CommandPalette } from './command-palette';
import { ConsoleSidebar } from './console-sidebar';
import { FrameState } from './frame-state';

// The frame of every console page: the navigation by role, a top bar with the search and the
// main action, the page, which decides its own width, and on phones a bar of destinations
// (research R15). The session is read behind its own Suspense boundaries, so a navigation never
// waits for it.
export function ConsoleFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <FrameState>
      <Suspense fallback={<ConsoleSidebar user={null} />}>
        <SignedInSidebar />
      </Suspense>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 md:px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="!h-5" />
          <Suspense fallback={<CommandPalette role={null} />}>
            <TopBar />
          </Suspense>
        </header>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        <Suspense fallback={<BottomBar role={null} />}>
          <SignedInBottomBar />
        </Suspense>
      </SidebarInset>
    </FrameState>
  );
}

async function SignedInSidebar() {
  const user = await currentUser();
  return <ConsoleSidebar user={user} />;
}

async function SignedInBottomBar() {
  const user = await currentUser();
  return <BottomBar role={user?.role ?? null} />;
}

async function TopBar() {
  const user = await currentUser();
  const author = user?.role === 'admin' || user?.role === 'editor';

  return (
    <>
      <CommandPalette role={user?.role ?? null} />
      {author && (
        <Button asChild size="sm" className="ml-auto">
          <Link href="/workflows/new">
            <PlusIcon data-icon="inline-start" />
            <span className="hidden sm:inline">New workflow</span>
          </Link>
        </Button>
      )}
    </>
  );
}
