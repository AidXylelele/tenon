"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { holdLeaving } from "@/libs/routing/leaving";
import type { LeaveGuard } from "./interfaces";

export function useLeaveGuard(changed: boolean): LeaveGuard {
  const router = useRouter();
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    if (!changed) return;

    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    function intercept(event: MouseEvent) {
      const link = linkOf(event);

      if (link === null) return;

      event.preventDefault();
      event.stopPropagation();
      setLeaving(link);
    }

    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, { capture: true });
    const release = holdLeaving(setLeaving);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, { capture: true });
      release();
    };
  }, [changed]);

  function stay() {
    setLeaving(null);
  }

  function leave() {
    const target = leaving;
    setLeaving(null);

    if (target !== null) router.push(target);
  }

  return { leaving, stay, leave };
}

function linkOf(event: MouseEvent): string | null {
  const modified =
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey;

  if (modified || !(event.target instanceof Element)) return null;

  const anchor = event.target.closest("a[href]");

  if (!(anchor instanceof HTMLAnchorElement)) return null;

  const url = new URL(anchor.href);
  const internal = url.origin === window.location.origin;
  const elsewhere = url.pathname !== window.location.pathname;

  if (!internal || !elsewhere || anchor.target === "_blank") return null;

  return `${url.pathname}${url.search}`;
}
