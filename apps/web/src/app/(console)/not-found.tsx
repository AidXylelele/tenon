import Link from 'next/link';
import { Button } from '@/libs/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/libs/ui/components/empty';

export default function ConsoleNotFound() {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>Not found</EmptyTitle>
        <EmptyDescription>
          It does not exist or was deleted. Lists show what is there now.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/instances">Runs</Link>
          </Button>
          <Button asChild>
            <Link href="/workflows">Workflows</Link>
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
