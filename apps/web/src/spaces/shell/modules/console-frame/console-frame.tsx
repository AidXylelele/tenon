import { CloudOffIcon, PlusIcon } from "lucide-react";
import { Suspense } from "react";
import { platformReady } from "@/libs/data-access/health";
import { Link } from "@/libs/routing/link";
import { NEW_WORKFLOW_HREF } from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";
import { SidebarInset, SidebarTrigger } from "@/libs/ui/components/sidebar";
import { chosenTheme } from "../../__shared_context/chosen-theme";
import { BottomBar } from "./bottom-bar";
import { CommandPalette } from "./command-palette";
import { ConsoleSidebar } from "./console-sidebar";
import { FrameState } from "./frame-state";
import { signedIn } from "./signed-in";

export function ConsoleFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <FrameState>
      <a
        href="#content"
        className="sr-only z-50 rounded-lg bg-background px-3 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Suspense
        fallback={<ConsoleSidebar session={null} theme="system" loading />}
      >
        <SignedInSidebar />
      </Suspense>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-3 md:px-4">
          <SidebarTrigger />
          <Suspense fallback={<CommandPalette session={null} />}>
            <TopBar />
          </Suspense>
        </header>
        <Suspense fallback={null}>
          <PlatformNotice />
        </Suspense>
        <main
          id="content"
          tabIndex={-1}
          className="flex min-w-0 flex-1 flex-col outline-none"
        >
          {children}
        </main>
        <Suspense fallback={<BottomBar session={null} />}>
          <SignedInBottomBar />
        </Suspense>
      </SidebarInset>
    </FrameState>
  );
}

async function SignedInSidebar() {
  const [session, theme] = await Promise.all([signedIn(), chosenTheme()]);
  return <ConsoleSidebar session={session} theme={theme} loading={false} />;
}

async function SignedInBottomBar() {
  const session = await signedIn();
  return <BottomBar session={session} />;
}

async function TopBar() {
  const session = await signedIn();
  const author = session?.capabilities.author === true;

  return (
    <>
      <CommandPalette session={session} />
      {author && (
        <Button asChild className="ml-auto">
          <Link href={NEW_WORKFLOW_HREF}>
            <PlusIcon data-icon="inline-start" />
            <span className="hidden sm:inline">New workflow</span>
            <span className="sr-only sm:hidden">New workflow</span>
          </Link>
        </Button>
      )}
    </>
  );
}

async function PlatformNotice() {
  const ready = await platformReady();

  if (ready) return null;

  return (
    <div className="flex items-center gap-2 border-b bg-warning-soft px-4 py-2 text-sm text-foreground md:px-6">
      <CloudOffIcon className="size-4 shrink-0 text-warning" aria-hidden />
      The platform is not ready. Pages try again by themselves until it is back.
    </div>
  );
}
