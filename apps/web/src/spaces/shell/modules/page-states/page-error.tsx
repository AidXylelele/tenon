"use client";

import { ErrorPanel } from "@/libs/ui/composites/error-panel";
import { PageBody } from "@/libs/ui/composites/page-body";

export function PageError({
  error,
  retry,
}: {
  readonly error: unknown;
  readonly retry: () => void;
}) {
  const digest =
    error instanceof Error && "digest" in error
      ? String(error.digest)
      : undefined;

  return (
    <PageBody>
      <ErrorPanel retry={retry} digest={digest} />
    </PageBody>
  );
}
