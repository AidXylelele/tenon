"use client";

import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { useEffect, useTransition } from "react";
import { Button } from "../components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "../components/empty";
import { Spinner } from "../components/spinner";

const AGAIN_MS = 5_000;

interface ErrorPanelProps {
  readonly retry: () => void;
  readonly digest?: string;
}

export function ErrorPanel({ retry, digest }: ErrorPanelProps) {
  const [pending, start] = useTransition();

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") start(retry);
    }, AGAIN_MS);
    return () => {
      clearInterval(timer);
    };
  }, [retry]);

  return (
    <Empty className="flex-none border-solid border bg-card py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <h1 className="heading-1">This page could not be loaded</h1>
        <EmptyDescription>
          The platform did not answer as expected. This page tries again by
          itself every few seconds.
          {digest !== undefined && (
            <span className="mt-1 block text-xs">Reference {digest}</span>
          )}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          onClick={() => {
            start(retry);
          }}
          disabled={pending}
        >
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
