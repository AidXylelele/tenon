"use client";

import { useRouter } from "next/navigation";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/libs/ui/components/toggle-group";

export type VersionView = "flow" | "code";

interface ViewChoiceProps {
  readonly view: VersionView;
  readonly hrefs: Readonly<Record<VersionView, string>>;
}

export function ViewChoice({ view, hrefs }: ViewChoiceProps) {
  const router = useRouter();

  function choose(next: string) {
    if (next !== "flow" && next !== "code") return;

    const href = hrefs[next];
    router.replace(href, { scroll: false });
  }

  return (
    <ToggleGroup
      type="single"
      value={view}
      onValueChange={choose}
      aria-label="View"
    >
      <ToggleGroupItem value="flow">Flow</ToggleGroupItem>
      <ToggleGroupItem value="code">Code</ToggleGroupItem>
    </ToggleGroup>
  );
}
