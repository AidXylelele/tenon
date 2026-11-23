"use client";

import { WifiOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

const RECHECK_MS = 30_000;

export function OfflineStrip({ reachable }: { readonly reachable: boolean }) {
  const online = useOnline();
  useRecheckWhileUnreachable(reachable);
  const lost = !reachable || !online;

  return (
    <div role="status">
      {lost && (
        <p className="flex items-center gap-2 border-b border-warning-border bg-warning-soft px-4 py-2 text-warning-strong">
          <WifiOffIcon className="size-4 shrink-0 text-warning" aria-hidden />
          Can&apos;t reach Tenon. Your changes are kept and sent when it is
          back.
        </p>
      )}
    </div>
  );
}

function useRecheckWhileUnreachable(reachable: boolean): void {
  const router = useRouter();

  useEffect(() => {
    if (reachable) return;

    const recheck = () => {
      router.refresh();
    };
    const timer = window.setInterval(recheck, RECHECK_MS);
    window.addEventListener("online", recheck);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", recheck);
    };
  }, [reachable, router]);
}

function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, onlineOnServer);
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function isOnline(): boolean {
  return navigator.onLine;
}

function onlineOnServer(): boolean {
  return true;
}
