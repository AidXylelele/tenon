"use client";

import { useSyncExternalStore } from "react";

type ColorScheme = "light" | "dark";

const QUERY = "(prefers-color-scheme: dark)";

export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(subscribe, schemeNow, schemeOnServer);
}

function subscribe(listener: () => void): () => void {
  const query = window.matchMedia(QUERY);
  const observer = new MutationObserver(listener);
  query.addEventListener("change", listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => {
    query.removeEventListener("change", listener);
    observer.disconnect();
  };
}

function schemeNow(): ColorScheme {
  const chosen = document.documentElement.dataset.theme;

  if (chosen === "light" || chosen === "dark") return chosen;

  const dark = window.matchMedia(QUERY).matches;
  return dark ? "dark" : "light";
}

function schemeOnServer(): ColorScheme {
  return "light";
}
