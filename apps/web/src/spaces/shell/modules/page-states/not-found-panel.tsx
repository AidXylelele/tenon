"use client";

import { SearchXIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { Link } from "@/libs/routing/link";
import { HOME_HREF } from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/libs/ui/components/empty";
import { placeOf } from "../../__shared_context/places";
import { type Missing, missingOf } from "./missing";

export function NotFoundPanel() {
  const pathname = usePathname();
  const place = placeOf(pathname);
  const label = place?.label ?? "Home";
  const href = place?.href ?? HOME_HREF;
  const missing = missingOf(pathname);

  return (
    <Empty className="flex-none border border-solid bg-card px-6 py-12">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <Said missing={missing} />
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" asChild>
          <Link href={href}>Go to {label}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

function Said({ missing }: { readonly missing: Missing | null }) {
  if (missing === null)
    return (
      <>
        <h1 className="heading-1">Nothing at this address</h1>
        <EmptyDescription>
          It does not exist, or it was deleted.
        </EmptyDescription>
      </>
    );

  return (
    <>
      <h1 className="heading-1">No {missing.kind} with this address</h1>
      <EmptyDescription>
        The {missing.kind} <span className="font-mono">{missing.id}</span> does
        not exist or was deleted.
      </EmptyDescription>
    </>
  );
}
