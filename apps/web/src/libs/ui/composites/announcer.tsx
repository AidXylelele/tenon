"use client";

import { createContext, useCallback, useContext, useState } from "react";

type Announce = (message: string) => void;

interface Said {
  readonly count: number;
  readonly message: string;
}

const AnnounceContext = createContext<Announce | null>(null);

const NOTHING_SAID: Said = { count: 0, message: "" };

export function Announcer({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [said, setSaid] = useState(NOTHING_SAID);

  const announce = useCallback((message: string) => {
    setSaid((last) => ({ count: last.count + 1, message }));
  }, []);

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">
        <p key={said.count}>{said.message}</p>
      </div>
    </AnnounceContext.Provider>
  );
}

export function useAnnounce(): Announce {
  const announce = useContext(AnnounceContext);
  if (announce === null) {
    throw new Error("useAnnounce must be used within an Announcer.");
  }

  return announce;
}
