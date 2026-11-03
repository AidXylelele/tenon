import { Suspense } from 'react';
import { currentUser } from '@/libs/data-access/identity';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/libs/ui/components/sidebar';
import { BrandMark, PRODUCT_NAME } from '../../__shared_context/brand-mark';
import { ConsoleSidebar } from './console-sidebar';

// The frame of every console page: the navigation by role and the page. The session is read
// behind its own Suspense boundary, so a navigation never waits for it (docs, Instant
// navigation).
export function ConsoleFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Suspense fallback={<ConsoleSidebar user={null} />}>
        <SignedInSidebar />
      </Suspense>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur md:hidden">
          <SidebarTrigger />
          <BrandMark className="size-5" />
          <span className="text-sm font-medium">{PRODUCT_NAME}</span>
        </header>
        <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

async function SignedInSidebar() {
  const user = await currentUser();
  return <ConsoleSidebar user={user} />;
}
