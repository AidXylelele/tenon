'use client';

import NextLink from 'next/link';
import { type ComponentProps, useState } from 'react';

type LinkProps = ComponentProps<typeof NextLink>;

// A link that loads its page ahead only once the person shows intent — pointing at it, focusing
// it, touching it — Next's hover-triggered prefetch (docs, Prefetching). Live pages refresh, and
// a refresh empties the router's cache, so links that prefetch on sight would load every visible
// target again on each refresh (research R14).
export function Link({
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: LinkProps) {
  const [intent, setIntent] = useState(false);

  return (
    <NextLink
      {...props}
      prefetch={intent ? null : false}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
