"use client";

import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { Link } from "@/libs/routing/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/libs/ui/components/breadcrumb";
import { cn } from "@/libs/ui/tokens/cn";
import { type Crumb, trailOf } from "../../__shared_context/trail";

const SHOWN_WHEN_NARROW = 2;
const HIDDEN_WHEN_NARROW = "max-md:hidden";

export function BreadcrumbTrail() {
  const pathname = usePathname();
  const trail = trailOf(pathname);

  if (trail.length === 0) return <div className="flex-1" />;

  const firstShown = Math.max(trail.length - SHOWN_WHEN_NARROW, 0);

  return (
    <Breadcrumb aria-label="Breadcrumb" className="min-w-0 flex-1">
      <BreadcrumbList className="flex-nowrap">
        {trail.map((crumb, index) => {
          const key = `${crumb.label}-${String(index)}`;
          const crumbHidden = index < firstShown && HIDDEN_WHEN_NARROW;
          const separatorHidden = index <= firstShown && HIDDEN_WHEN_NARROW;
          const separator = cn("shrink-0 text-faint", separatorHidden);
          const item = cn("min-w-0", crumbHidden);

          return (
            <Fragment key={key}>
              {index > 0 && <BreadcrumbSeparator className={separator} />}
              <BreadcrumbItem className={item}>
                <Step crumb={crumb} />
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function Step({ crumb }: { readonly crumb: Crumb }) {
  if (crumb.href === undefined)
    return (
      <BreadcrumbPage className="truncate font-semibold">
        {crumb.label}
      </BreadcrumbPage>
    );

  return (
    <BreadcrumbLink asChild>
      <Link href={crumb.href} className="truncate hover:underline">
        {crumb.label}
      </Link>
    </BreadcrumbLink>
  );
}
