import Link from 'next/link';
import { Button } from '@/libs/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/libs/ui/components/empty';

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Nothing here</EmptyTitle>
          <EmptyDescription>
            The page does not exist, or what it showed was deleted or archived
            away.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/workflows">Go to workflows</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
