"use client";

import NextLink from "next/link";
import { type ComponentProps, useState } from "react";

type LinkProps = ComponentProps<typeof NextLink>;

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
