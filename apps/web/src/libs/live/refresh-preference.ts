"use client";

import { useSyncExternalStore } from "react";

export type RefreshChoice =
  "auto" | "off" | "5000" | "10000" | "30000" | "60000" | "300000";

export const REFRESH_CHOICES: readonly RefreshChoice[] = [
  "auto",
  "off",
  "5000",
  "10000",
  "30000",
  "60000",
  "300000",
];

const KEY = "console.refresh";
const CHANGED = "console:refresh-changed";

let remembered: RefreshChoice = "auto";

export function useRefreshChoice(): RefreshChoice {
  return useSyncExternalStore(subscribe, storedChoice, defaultChoice);
}

export function chooseRefresh(choice: RefreshChoice): void {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    remembered = choice;
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGED, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGED, listener);
  };
}

function storedChoice(): RefreshChoice {
  try {
    const stored = window.localStorage.getItem(KEY);
    const known = REFRESH_CHOICES.find((choice) => choice === stored);
    return known ?? remembered;
  } catch {
    return remembered;
  }
}

function defaultChoice(): RefreshChoice {
  return "auto";
}
