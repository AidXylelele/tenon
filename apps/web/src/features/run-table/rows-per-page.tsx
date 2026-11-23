"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/libs/ui/components/select";
import type { PageSize } from "./interfaces";

export function RowsPerPage({
  size,
  sizes,
}: {
  readonly size: number;
  readonly sizes: readonly PageSize[];
}) {
  const router = useRouter();
  const label = useId();
  const chosen = String(size);

  function choose(value: string) {
    const found = sizes.find((each) => String(each.size) === value);

    if (found === undefined) return;

    router.push(found.href);
  }

  return (
    <span className="flex items-center gap-2 text-muted-foreground">
      <span id={label}>Rows per page</span>
      <Select value={chosen} onValueChange={choose}>
        <SelectTrigger aria-labelledby={label} className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sizes.map((each) => (
            <SelectItem key={each.size} value={String(each.size)}>
              {each.size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
}
