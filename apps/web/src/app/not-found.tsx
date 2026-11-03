import Link from 'next/link';
import { connection } from 'next/server';
import { Button } from '@/libs/ui/components/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/libs/ui/components/empty';
import { WORKFLOWS_HREF } from '@/operations/app-routes';

// Rendered per request, so its scripts carry the request's CSP nonce.
export default async function NotFound() {
  await connection();
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
            <Link href={WORKFLOWS_HREF}>Go to workflows</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
