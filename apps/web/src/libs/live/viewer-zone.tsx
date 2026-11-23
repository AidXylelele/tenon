"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ZONE_COOKIE } from "@/libs/data-access/viewer-zone";

const YEAR_SECONDS = 31_536_000;

export function ViewerZone({ zone }: { readonly zone: string }) {
  const router = useRouter();

  useEffect(() => {
    const own = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (own === zone) return;

    const value = encodeURIComponent(own);
    const pair = `${ZONE_COOKIE}=${value}`;
    const before = document.cookie;
    document.cookie = `${pair}; path=/; max-age=${String(YEAR_SECONDS)}; samesite=lax`;
    const after = document.cookie;

    if (after === before) return;

    router.refresh();
  }, [zone, router]);

  return null;
}
