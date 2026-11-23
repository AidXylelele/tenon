"use client";

import { useSyncExternalStore } from "react";
import {
  type Theme,
  themeAttributeOf,
  themeOf,
} from "../../__shared_context/theme";

export type KeepTheme = (chosen: string) => Promise<void>;

interface ThemeChoice {
  readonly theme: Theme;
  readonly choose: (chosen: string) => void;
}

export function useThemeChoice(keep: KeepTheme): ThemeChoice {
  const theme = useSyncExternalStore(subscribe, themeNow, systemOnServer);

  function choose(chosen: string) {
    chooseTheme(chosen, keep);
  }

  return { theme, choose };
}

export function chooseTheme(chosen: string, keep: KeepTheme): void {
  const next = themeOf(chosen);
  const attribute = themeAttributeOf(next);
  const root = document.documentElement;

  if (attribute === undefined) delete root.dataset.theme;
  else root.dataset.theme = attribute;

  void keep(next);
}

function subscribe(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => {
    observer.disconnect();
  };
}

function themeNow(): Theme {
  const attribute = document.documentElement.dataset.theme;
  return themeOf(attribute);
}

function systemOnServer(): Theme {
  return "system";
}
