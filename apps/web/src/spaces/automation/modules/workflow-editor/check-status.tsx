'use client';

import { CircleAlertIcon, CircleCheckIcon, CloudOffIcon } from 'lucide-react';
import { Button } from '@/libs/ui/components/button';
import { Spinner } from '@/libs/ui/components/spinner';
import type { CheckState } from './use-check';

interface CheckStatusProps {
  readonly state: CheckState;
  readonly textError: string | null;
  readonly onShow: () => void;
}

// What the platform's check says about the draft on screen, always visible, so the author
// knows whether publishing would be accepted before trying (spec FR-004).
export function CheckStatus({ state, textError, onShow }: CheckStatusProps) {
  if (textError !== null)
    return (
      <Status
        tone="text-red-600 dark:text-red-400"
        icon={<CircleAlertIcon className="size-4" />}
      >
        {textError}
      </Status>
    );

  switch (state.kind) {
    case 'checking':
      return (
        <Status
          tone="text-muted-foreground"
          icon={<Spinner className="size-4" />}
        >
          Checking with the platform…
        </Status>
      );
    case 'clean':
      return (
        <Status
          tone="text-emerald-700 dark:text-emerald-400"
          icon={<CircleCheckIcon className="size-4" />}
        >
          Ready to publish
        </Status>
      );
    case 'unreachable':
      return (
        <Status
          tone="text-amber-700 dark:text-amber-400"
          icon={<CloudOffIcon className="size-4" />}
        >
          The platform did not answer; the check runs again on your next edit
        </Status>
      );
    case 'problem': {
      const [first] = state.problem.errors;
      return (
        <span className="flex min-w-0 items-center gap-1">
          <Status
            tone="text-red-600 dark:text-red-400"
            icon={<CircleAlertIcon className="size-4" />}
          >
            {first?.detail ?? state.problem.detail}
          </Status>
          <Button
            type="button"
            variant="link"
            size="sm"
            onClick={onShow}
            className="shrink-0 px-1"
          >
            Show
          </Button>
        </span>
      );
    }
  }
}

function Status({
  tone,
  icon,
  children,
}: {
  readonly tone: string;
  readonly icon: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 text-sm ${tone}`}
      role="status"
      aria-live="polite"
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{children}</span>
    </span>
  );
}
