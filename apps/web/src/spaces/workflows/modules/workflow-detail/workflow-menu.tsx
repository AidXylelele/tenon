"use client";

import { ArchiveIcon, DownloadIcon, EllipsisIcon } from "lucide-react";
import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { ConfirmDialog } from "@/libs/ui/composites/confirm-dialog";
import { IconButton } from "@/libs/ui/composites/icon-button";
import { archiveAction } from "./actions";

interface WorkflowMenuProps {
  readonly namespace: string;
  readonly name: string;
  readonly archives: boolean;
  readonly download: string | null;
}

export function WorkflowMenu({
  namespace,
  name,
  archives,
  download,
}: WorkflowMenuProps) {
  const [archiving, setArchiving] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = `Archive ${name}?`;
  const archive = archiveAction.bind(null, namespace, name);
  const archived = `${name} archived`;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton ref={trigger} label="More actions" icon={EllipsisIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {download !== null && (
            <DropdownMenuItem asChild>
              <a href={download} download>
                <DownloadIcon aria-hidden />
                Download YAML
              </a>
            </DropdownMenuItem>
          )}
          {archives && (
            <>
              {download !== null && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  setArchiving(true);
                }}
              >
                <ArchiveIcon aria-hidden />
                Archive…
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={title}
        description="It starts no run and takes no version. Its versions and runs stay readable. Archiving cannot be undone."
        actionLabel="Archive workflow"
        icon={<ArchiveIcon data-icon="inline-start" />}
        action={archive}
        success={archived}
        returnFocus={() => trigger.current}
      />
    </>
  );
}
