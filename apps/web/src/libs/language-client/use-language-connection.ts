"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { reasonOf } from "./failures";
import type { LanguageConnection, LanguageState } from "./interfaces";

const STARTING: LanguageState = { kind: "starting" };

export function useLanguageConnection(
  connect: () => LanguageConnection,
): LanguageState {
  const [state, setState] = useState<LanguageState>(STARTING);
  const open = useEffectEvent(connect);

  useEffect(() => {
    const connection = open();
    let alive = true;

    connection.client.initializing.then(
      () => {
        if (alive) setState({ kind: "ready", connection });
      },
      (failure: unknown) => {
        const reason = reasonOf(failure);

        if (alive) setState({ kind: "failed", reason });
      },
    );

    return () => {
      alive = false;
      connection.close();
    };
  }, []);

  return state;
}
