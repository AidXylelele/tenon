'use client';

import {
  ActivityIcon,
  KeyRoundIcon,
  HouseIcon,
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
import { useEffect, useEffectEvent, useState, useTransition } from 'react';
import type { Role } from '@/libs/data-access/types';
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
import { Spinner } from '@/libs/ui/components/spinner';
import { type FoundWorkflow, searchableWorkflowsAction } from './actions';

const AUTHORS: readonly Role[] = ['admin', 'editor'];

const PAGES = [
  { href: '/', label: 'Home', icon: HouseIcon, roles: null },
  { href: '/workflows', label: 'Workflows', icon: WaypointsIcon, roles: null },
  { href: '/instances', label: 'Runs', icon: ActivityIcon, roles: null },
  {
    href: '/instances?phase=faulted',
    label: 'Runs that faulted',
    icon: ActivityIcon,
    roles: null,
  },
  {
    href: '/connections/webhooks',
    label: 'Webhooks',
    icon: WebhookIcon,
    roles: AUTHORS,
  },
  {
    href: '/connections/notifications',
    label: 'Notifications',
    icon: RadioTowerIcon,
    roles: AUTHORS,
  },
  {
    href: '/connections/test-event',
    label: 'Send a test event',
    icon: SendIcon,
    roles: AUTHORS,
  },
  {
    href: '/credentials',
    label: 'Credentials',
    icon: KeyRoundIcon,
    roles: AUTHORS,
  },
  {
    href: '/settings/account',
    label: 'Account and password',
    icon: UserIcon,
    roles: null,
  },
  {
    href: '/settings/team',
    label: 'Team and invitations',
    icon: UsersIcon,
    roles: ['admin'] as readonly Role[],
  },
  {
    href: '/settings/standard',
    label: 'Supported standard',
    icon: ShieldCheckIcon,
    roles: null,
  },
] as const;

// Search (⌘K or Ctrl+K): every page the role may open, the main actions, and the workflows.
export function CommandPalette({ role }: { readonly role: Role | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<readonly FoundWorkflow[] | null>(null);
  const [loading, startLoading] = useTransition();
  const author = role !== null && AUTHORS.includes(role);

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

    if (next)
      startLoading(async () => {
        setFound(await searchableWorkflowsAction());
      });
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const pages = PAGES.filter(
    (page) =>
      page.roles === null || (role !== null && page.roles.includes(role)),
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
                <CommandItem onSelect={() => go('/workflows/new')}>
                  <PlusIcon />
                  New workflow
                </CommandItem>
                <CommandItem onSelect={() => go('/connections/webhooks')}>
                  <WebhookIcon />
                  New webhook
                </CommandItem>
                <CommandItem onSelect={() => go('/connections/test-event')}>
                  <SendIcon />
                  Send a test event
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Workflows">
              {loading && found === null && (
                <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
                  <Spinner className="size-3.5" />
                  Reading workflows…
                </div>
              )}
              {found?.map((each) => (
                <CommandItem
                  key={`${each.namespace}/${each.name}`}
                  value={`${each.namespace} ${each.name}`}
                  onSelect={() =>
                    go(
                      `/workflows/${encodeURIComponent(each.namespace)}/${encodeURIComponent(each.name)}`,
                    )
                  }
                >
                  <WaypointsIcon />
                  <span>{each.name}</span>
                  <span className="text-muted-foreground">
                    {each.namespace}
                  </span>
                  {each.on && (
                    <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-400">
                      On
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
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
