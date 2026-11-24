import { LockIcon } from "lucide-react";
import { EmptyState } from "@/libs/ui/composites/empty-state";

const VIEWERS_READ = "Viewers read workflows and runs.";

export function ViewerNotice({ what }: { readonly what: string }) {
  const description = `${what} ${VIEWERS_READ} Ask an administrator for the editor role.`;

  return (
    <EmptyState
      icon={<LockIcon />}
      title="For editors and administrators"
      description={description}
    />
  );
}

export function ViewerLine() {
  return <p className="text-sm text-muted-foreground">{VIEWERS_READ}</p>;
}
