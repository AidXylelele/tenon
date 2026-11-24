"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { FLAG } from "./flag";

type AddressChanges = Readonly<Record<string, string | null>>;

interface AddressState {
  readonly flagged: (name: string) => boolean;
  readonly value: (name: string) => string | null;
  readonly change: (changes: AddressChanges) => void;
}

export function useAddressState(): AddressState {
  const pathname = usePathname();
  const params = useSearchParams();

  const flagged = useCallback(
    (name: string) => params.get(name) === FLAG,
    [params],
  );

  const value = useCallback((name: string) => params.get(name), [params]);

  const change = useCallback(
    (changes: AddressChanges) => {
      const next = new URLSearchParams(params);

      for (const [name, set] of Object.entries(changes))
        if (set === null) next.delete(name);
        else next.set(name, set);

      const query = next.toString();
      const href = query === "" ? pathname : `${pathname}?${query}`;
      window.history.replaceState(null, "", href);
    },
    [params, pathname],
  );

  return { flagged, value, change };
}
