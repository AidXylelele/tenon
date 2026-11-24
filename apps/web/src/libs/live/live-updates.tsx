"use client";

import { WifiOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, useTransition } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/libs/ui/components/alert";
import { Button } from "@/libs/ui/components/button";

export type Activity = "in-flight" | "open" | "ended";

interface LiveRefresh {
  readonly paused: boolean;
  readonly reconnect: () => void;
}

const EVERY_MS: Readonly<Record<Activity, number | null>> = {
  "in-flight": 5_000,
  open: 60_000,
  ended: null,
};

function useLiveRefresh(activity: Activity): LiveRefresh {
  const router = useRouter();
  const [, start] = useTransition();
  const visible = useSyncExternalStore(
    subscribeToVisibility,
    isVisible,
    alwaysTrue,
  );
  const online = useSyncExternalStore(subscribeToNetwork, isOnline, alwaysTrue);
  const every = EVERY_MS[activity];

  useEffect(() => {
    if (every === null || !visible || !online) return;

    const timer = setInterval(() => {
      start(() => {
        router.refresh();
      });
    }, every);
    return () => {
      clearInterval(timer);
    };
  }, [every, visible, online, router]);

  function reconnect() {
    start(() => {
      router.refresh();
    });
  }

  return { paused: !online, reconnect };
}

export function LiveUpdates({ activity }: { readonly activity: Activity }) {
  const live = useLiveRefresh(activity);

  if (!live.paused) return null;

  return (
    <Alert>
      <WifiOffIcon />
      <AlertTitle>Live updates paused</AlertTitle>
      <AlertDescription>
        The connection to Tenon was lost; what is shown may be out of date.
        <Button variant="outline" size="sm" onClick={live.reconnect}>
          Reconnect
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function subscribeToVisibility(listener: () => void): () => void {
  document.addEventListener("visibilitychange", listener);
  return () => {
    document.removeEventListener("visibilitychange", listener);
  };
}

function subscribeToNetwork(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function isVisible(): boolean {
  return document.visibilityState === "visible";
}

function isOnline(): boolean {
  return navigator.onLine;
}

function alwaysTrue(): boolean {
  return true;
}
