"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface Named {
  readonly href: string;
  readonly label: string;
}

interface Naming {
  readonly named: Named | null;
  readonly name: (named: Named | null) => void;
}

const NamingContext = createContext<Naming | null>(null);

export function TrailNames({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const [named, name] = useState<Named | null>(null);
  const naming = { named, name };

  return <NamingContext value={naming}>{children}</NamingContext>;
}

export function TrailName({ href, label }: Named) {
  const name = useContext(NamingContext)?.name;

  useEffect(() => {
    name?.({ href, label });

    return () => {
      name?.(null);
    };
  }, [name, href, label]);

  return null;
}

export function useTrailName(): Named | null {
  return useContext(NamingContext)?.named ?? null;
}
