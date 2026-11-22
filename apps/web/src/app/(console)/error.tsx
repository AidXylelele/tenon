"use client";

import { PageError } from "@/spaces/shell/modules/page-states";

export default function ConsoleError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return <PageError error={error} retry={retry} />;
}
