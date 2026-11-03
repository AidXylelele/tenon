'use client';

import { ErrorPanel } from '@/libs/ui/composites/error-panel';

export default function ConsoleError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest =
    error instanceof Error && 'digest' in error
      ? String(error.digest)
      : undefined;
  return <ErrorPanel retry={retry} digest={digest} />;
}
