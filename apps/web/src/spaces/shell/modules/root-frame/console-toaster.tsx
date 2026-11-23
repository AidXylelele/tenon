"use client";

import { Toaster } from "@/libs/ui/components/sonner";
import { useColorScheme } from "@/libs/ui/hooks/use-color-scheme";

export function ConsoleToaster() {
  const scheme = useColorScheme();

  return (
    <Toaster
      position="bottom-right"
      offset="var(--space-4)"
      containerAriaLabel="Messages"
      closeButton
      theme={scheme}
    />
  );
}
