"use client";

import { useRouter } from "next/navigation";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/libs/ui/components/toggle-group";
import { periodLabel, PERIODS } from "@/operations/run-periods";
import type { PeriodPickerProps } from "./interfaces";

export function PeriodPicker({ period, hrefs }: PeriodPickerProps) {
  const router = useRouter();

  function choose(value: string) {
    const chosen = PERIODS.find((each) => each === value);

    if (chosen === undefined) return;

    router.push(hrefs[chosen]);
  }

  return (
    <ToggleGroup
      type="single"
      value={period}
      onValueChange={choose}
      aria-label="Period"
    >
      {PERIODS.map((each) => (
        <ToggleGroupItem key={each} value={each}>
          {periodLabel(each)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
