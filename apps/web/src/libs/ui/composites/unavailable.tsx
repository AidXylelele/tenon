"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ErrorPanel } from "./error-panel";

export function Unavailable() {
  const router = useRouter();
  const retry = useCallback(() => {
    router.refresh();
  }, [router]);

  return <ErrorPanel retry={retry} />;
}
