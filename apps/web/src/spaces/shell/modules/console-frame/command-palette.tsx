'use client';

import {
  ActivityIcon,
  KeyRoundIcon,
  HouseIcon,
  type LucideIcon,
  PlusIcon,
  RadioTowerIcon,
  SearchIcon,
  SendIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
  WaypointsIcon,
  WebhookIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useEffectEvent, useState } from 'react';
import type { User } from '@/libs/data-access/types';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/libs/ui/components/command';
import { Kbd } from '@/libs/ui/components/kbd';
import {
  type AccessRule,
  canAuthor,
  isAdministrator,
} from '@/operations/access-policy';
import {
  ACCOUNT_HREF,
  CREDENTIALS_HREF,
  HOME_HREF,
  INSTANCES_HREF,
  instancesHref,
  NEW_WORKFLOW_HREF,
  NOTIFICATIONS_HREF,
  STANDARD_HREF,
  TEAM_HREF,
  TEST_EVENT_HREF,
  WEBHOOKS_HREF,
  WORKFLOWS_HREF,
} from '@/operations/app-routes';
import { useWorkflowSearch, WorkflowResults } from './workflow-results';

interface Page {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  // Who may open it, or null for everyone.
  readonly access: AccessRule | null;
}

const PAGES: readonly Page[] = [
  { href: HOME_HREF, label: 'Home', icon: HouseIcon, access: null },
  {
    href: WORKFLOWS_HREF,
    label: 'Workflows',
    icon: WaypointsIcon,
    access: null,
  },
  { href: INSTANCES_HREF, label: 'Runs', icon: ActivityIcon, access: null },
  {
    href: instancesHref({ phase: 'faulted' }),
    label: 'Runs that faulted',
    icon: ActivityIcon,
    access: null,
  },
  {
    href: WEBHOOKS_HREF,
    label: 'Webhooks',
    icon: WebhookIcon,
    access: canAuthor,
  },
  {
    href: NOTIFICATIONS_HREF,
    label: 'Notifications',
    icon: RadioTowerIcon,
    access: canAuthor,
  },
  {
    href: TEST_EVENT_HREF,
    label: 'Send a test event',
    icon: SendIcon,
    access: canAuthor,
  },
  {
    href: CREDENTIALS_HREF,
    label: 'Credentials',
    icon: KeyRoundIcon,
    access: canAuthor,
  },
  {
    href: ACCOUNT_HREF,
    label: 'Account and password',
    icon: UserIcon,
    access: null,
  },
  {
    href: TEAM_HREF,
    label: 'Team and invitations',
    icon: UsersIcon,
    access: isAdministrator,
  },
  {
    href: STANDARD_HREF,
    label: 'Supported standard',
    icon: ShieldCheckIcon,
    access: null,
  },
];

// Search (⌘K or Ctrl+K): every page the user may open, the main actions, and the workflows.
export function CommandPalette({ user }: { readonly user: User | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const workflows = useWorkflowSearch();
  const author = canAuthor(user);

  // ⌘K opens it as the button does, workflows included.
  const toggle = useEffectEvent(() => change(!open));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey))
        return;

      event.preventDefault();
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function change(next: boolean) {
    setOpen(next);

    if (next) workflows.read();
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const pages = PAGES.filter(
    (page) => page.access === null || page.access(user),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => change(true)}
        className="flex h-9 w-full max-w-md items-center gap-2 rounded-xl border bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <SearchIcon className="size-4" />
        <span className="flex-1 text-left">Search workflows and pages</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>
      <CommandDialog
        open={open}
        onOpenChange={change}
        title="Search"
        description="Search workflows, pages and actions"
      >
        <Command>
          <CommandInput placeholder="Type a workflow, a page or an action…" />
          <CommandList>
            <CommandEmpty>Nothing matches.</CommandEmpty>
            {author && (
              <CommandGroup heading="Actions">
                <CommandItem onSelect={() => go(NEW_WORKFLOW_HREF)}>
                  <PlusIcon />
                  New workflow
                </CommandItem>
                <CommandItem onSelect={() => go(WEBHOOKS_HREF)}>
                  <WebhookIcon />
                  New webhook
                </CommandItem>
                <CommandItem onSelect={() => go(TEST_EVENT_HREF)}>
                  <SendIcon />
                  Send a test event
                </CommandItem>
              </CommandGroup>
            )}
            <WorkflowResults search={workflows} onGo={go} />
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {pages.map((page) => {
                const Icon = page.icon;
                return (
                  <CommandItem key={page.href} onSelect={() => go(page.href)}>
                    <Icon />
                    {page.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
