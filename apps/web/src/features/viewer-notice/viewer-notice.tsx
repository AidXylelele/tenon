import { LockIcon } from 'lucide-react';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/libs/ui/components/empty';

// What a viewer sees on a page that only editors and administrators use (003 FR-002).
export function ViewerNotice({ what }: { readonly what: string }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LockIcon />
        </EmptyMedia>
        <EmptyTitle>For editors and administrators</EmptyTitle>
        <EmptyDescription>
          {what} Viewers read workflows and runs; ask an administrator for the
          editor role.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
