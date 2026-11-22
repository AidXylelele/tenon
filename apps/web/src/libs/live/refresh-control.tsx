"use client";

import { cn } from "@/libs/ui/tokens/cn";
import { ChevronDownIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Button } from "@/libs/ui/components/button";
import { ButtonGroup } from "@/libs/ui/components/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import {
  chooseRefresh,
  REFRESH_CHOICES,
  type RefreshChoice,
  useRefreshChoice,
} from "./refresh-preference";

type Activity = "in-flight" | "open" | "ended";

const FIRST_MS = 1_000;
const IN_FLIGHT_MS = 5_000;
const OPEN_MS = 60_000;

interface RefreshControlProps {
  readonly activity: Activity;
  readonly renderedAt: number;
}

export function RefreshControl({ activity, renderedAt }: RefreshControlProps) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [askedAt, setAskedAt] = useState(0);
  const choice = useRefreshChoice();
  const visible = useSyncExternalStore(
    subscribeToVisibility,
    isVisible,
    isVisibleOnServer,
  );
  const now = useNow(visible);
  const opening =
    choice === "auto" && activity === "in-flight" && askedAt === 0;
  const intervalMs = opening ? FIRST_MS : intervalOf(choice, activity);

  useEffect(() => {
    if (intervalMs === null || !visible || refreshing) return;

    const last = Math.max(renderedAt, askedAt);
    const wait = Math.max(0, last + intervalMs - Date.now());
    const timer = setTimeout(() => {
      setAskedAt(Date.now());
      startRefresh(() => {
        router.refresh();
      });
    }, wait);
    return () => {
      clearTimeout(timer);
    };
  }, [intervalMs, visible, refreshing, renderedAt, askedAt, router]);

  const refreshNow = () => {
    setAskedAt(Date.now());
    startRefresh(() => {
      router.refresh();
    });
  };
  const live = activity === "in-flight" && intervalMs !== null && visible;

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            live ? "bg-success" : "bg-muted-foreground",
            live && refreshing && "animate-live",
          )}
        />
        <span suppressHydrationWarning>
          {freshnessOf(now, renderedAt, visible, intervalMs)}
        </span>
      </span>
      <ButtonGroup>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Refresh now"
          title="Refresh now"
          disabled={refreshing}
          onClick={refreshNow}
        >
          <RefreshCwIcon className={cn(refreshing && "animate-spin")} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              aria-label={`Refresh interval: ${labelOf(choice)}`}
              className="gap-1 px-2 tabular-nums"
            >
              {labelOf(choice)}
              <ChevronDownIcon className="size-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Refresh this page</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={choice}
              onValueChange={(value) => {
                chooseRefresh(value as RefreshChoice);
              }}
            >
              {REFRESH_CHOICES.map((each) => (
                <DropdownMenuRadioItem key={each} value={each}>
                  <span className="flex flex-col">
                    <span>{choiceLabelOf(each)}</span>
                    {each === "auto" && (
                      <span className="text-xs text-muted-foreground">
                        Every 5 s while something runs, otherwise every minute
                      </span>
                    )}
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </div>
  );
}

function intervalOf(choice: RefreshChoice, activity: Activity): number | null {
  if (choice === "off") return null;

  if (choice !== "auto") return Number(choice);

  if (activity === "in-flight") return IN_FLIGHT_MS;

  if (activity === "open") return OPEN_MS;

  return null;
}

function freshnessOf(
  now: number,
  renderedAt: number,
  visible: boolean,
  intervalMs: number | null,
): string {
  if (!visible && intervalMs !== null) return "Paused while hidden";

  const seconds = Math.max(0, Math.round((now - renderedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  const age = seconds < 60 ? `${String(seconds)} s` : `${String(minutes)} min`;
  return `Updated ${age} ago`;
}

function labelOf(choice: RefreshChoice): string {
  if (choice === "auto") return "Auto";

  if (choice === "off") return "Off";

  return durationOf(Number(choice));
}

function choiceLabelOf(choice: RefreshChoice): string {
  if (choice === "auto" || choice === "off") return labelOf(choice);

  return `Every ${durationOf(Number(choice))}`;
}

function durationOf(milliseconds: number): string {
  const seconds = milliseconds / 1000;
  const minutes = seconds / 60;
  return seconds < 60 ? `${String(seconds)} s` : `${String(minutes)} min`;
}

function subscribeToVisibility(listener: () => void): () => void {
  document.addEventListener("visibilitychange", listener);
  return () => {
    document.removeEventListener("visibilitychange", listener);
  };
}

function isVisible(): boolean {
  return document.visibilityState === "visible";
}

function isVisibleOnServer(): boolean {
  return true;
}

function useNow(ticking: boolean): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!ticking) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, [ticking]);

  return now;
}
