import { Suspense } from "react";
import { platformReady } from "@/libs/data-access/health";
import { AccountMenu } from "./account-menu";
import { keepThemeAction, signOutAction } from "./actions";
import { CommandPalette } from "./command-palette";
import { ConsoleRoot } from "./console-root";
import { ConsoleSidebar, SidebarLoading } from "./console-sidebar";
import { Frame } from "./frame";
import { OfflineStrip } from "./offline-strip";
import { savedSidebarChoice } from "./saved-sidebar";
import { signedIn } from "./signed-in";

export async function ConsoleFrame({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const saved = await savedSidebarChoice();

  return (
    <ConsoleRoot defaultOpen={saved}>
      <Frame
        sidebar={
          <Suspense fallback={<SidebarLoading />}>
            <SignedInSidebar />
          </Suspense>
        }
        search={
          <Suspense
            fallback={
              <CommandPalette capabilities={null} keepTheme={keepThemeAction} />
            }
          >
            <SignedInSearch />
          </Suspense>
        }
        notice={
          <Suspense fallback={<OfflineStrip reachable />}>
            <PlatformNotice />
          </Suspense>
        }
      >
        {children}
      </Frame>
    </ConsoleRoot>
  );
}

async function SignedInSidebar() {
  const session = await signedIn();
  const capabilities = session?.capabilities ?? null;
  const account =
    session === null ? null : (
      <AccountMenu
        user={session.user}
        signOut={signOutAction}
        keepTheme={keepThemeAction}
      />
    );

  return <ConsoleSidebar capabilities={capabilities} account={account} />;
}

async function SignedInSearch() {
  const session = await signedIn();
  const capabilities = session?.capabilities ?? null;

  return (
    <CommandPalette capabilities={capabilities} keepTheme={keepThemeAction} />
  );
}

async function PlatformNotice() {
  const ready = await platformReady();

  return <OfflineStrip reachable={ready} />;
}
