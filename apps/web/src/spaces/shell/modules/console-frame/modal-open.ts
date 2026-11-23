"use client";

import { useSyncExternalStore } from "react";

const HIDDEN_BY_A_MODAL = "data-aria-hidden";
const ANY_HIDDEN = `[${HIDDEN_BY_A_MODAL}]`;

export function useModalOpen(): boolean {
  return useSyncExternalStore(subscribe, isModalOpen, closedOnServer);
}

function subscribe(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: [HIDDEN_BY_A_MODAL],
    subtree: true,
  });
  return () => {
    observer.disconnect();
  };
}

function isModalOpen(): boolean {
  const hidden = document.querySelector(ANY_HIDDEN);
  return hidden !== null;
}

function closedOnServer(): boolean {
  return false;
}
