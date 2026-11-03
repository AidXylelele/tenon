'use client';

import { RotateCwIcon, TriangleAlertIcon } from 'lucide-react';
import { useTransition } from 'react';
import { Button } from '../components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../components/empty';
import { Spinner } from '../components/spinner';

interface ErrorPanelProps {
  readonly retry: () => void;
  readonly digest?: string;
}

// What a page says when it could not be shown: most often the platform is restarting or
// unreachable, so the way on is to try again.
export function ErrorPanel({ retry, digest }: ErrorPanelProps) {
  const [pending, start] = useTransition();

  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>This page could not be loaded</EmptyTitle>
        <EmptyDescription>
          The platform did not answer as expected. If it is restarting, trying
          again in a few seconds works.
          {digest !== undefined && (
            <span className="mt-1 block text-xs">Reference {digest}</span>
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => start(retry)} disabled={pending}>
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RotateCwIcon data-icon="inline-start" />
          )}
          Try again
        </Button>
      </EmptyContent>
    </Empty>
  );
}
