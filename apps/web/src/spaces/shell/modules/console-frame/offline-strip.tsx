"use client";

import { WifiOffIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

export function OfflineStrip({ reachable }: { readonly reachable: boolean }) {
  const online = useOnline();
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
