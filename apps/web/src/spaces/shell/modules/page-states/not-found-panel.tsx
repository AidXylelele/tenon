import { SearchXIcon } from "lucide-react";
import { Link } from "@/libs/routing/link";
import { RUNS_HREF, WORKFLOWS_HREF } from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
} from "@/libs/ui/components/empty";

export function NotFoundPanel() {
  return (
    <Empty className="flex-none border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <h1 className="heading-1">Not found</h1>
        <EmptyDescription>
          It does not exist, or it was deleted. The lists show what is there
          now.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={RUNS_HREF}>Runs</Link>
          </Button>
          <Button asChild>
            <Link href={WORKFLOWS_HREF}>Workflows</Link>
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
