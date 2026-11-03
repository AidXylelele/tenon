import { Fragment } from 'react';
import { Link } from '@/libs/routing/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/libs/ui/components/breadcrumb';

export interface Crumb {
  readonly label: string;
  // Absent on the page itself, the last crumb.
  readonly href?: string;
}

// Where a page sits (FR-034): its parents as links, then the page.
export function Crumbs({ trail }: { readonly trail: readonly Crumb[] }) {
  return (
    <Breadcrumb>
      <BreadcrumbList className="text-xs">
        {trail.map((crumb, index) => (
          <Fragment key={`${crumb.label}-${String(index)}`}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem className="min-w-0">
              {crumb.href === undefined ? (
                <BreadcrumbPage className="truncate">
                  {crumb.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href} className="truncate">
                    {crumb.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
