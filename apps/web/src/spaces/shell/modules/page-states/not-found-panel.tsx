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

export function NotFoundPanel() {
  const pathname = usePathname();
  const place = placeOf(pathname);
  const label = place?.label ?? "Home";
  const href = place?.href ?? HOME_HREF;

  return (
    <Empty className="flex-none border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <h1 className="heading-1">Nothing at this address</h1>
        <EmptyDescription>
          It does not exist, or it was deleted.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" asChild>
          <Link href={href}>Go to {label}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
