"use client";

import { EllipsisIcon, Trash2Icon } from "lucide-react";
import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { ConfirmDialog } from "@/libs/ui/composites/confirm-dialog";
import { IconButton } from "@/libs/ui/composites/icon-button";
import { deleteSubscriptionAction } from "./actions";

interface NotificationMenuProps {
  readonly id: string;
  readonly name: string;
}

export function NotificationMenu({ id, name }: NotificationMenuProps) {
  const [deleting, setDeleting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = `Delete the notification ${name}?`;
  const remove = deleteSubscriptionAction.bind(null, id);
  const removed = `${name} deleted`;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton ref={trigger} label="More actions" icon={EllipsisIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setDeleting(true);
            }}
          >
            <Trash2Icon aria-hidden />
            Delete notification…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={title}
        description="Nothing more is delivered to it, and its pending retries stop."
        actionLabel="Delete notification"
        icon={<Trash2Icon data-icon="inline-start" />}
        action={remove}
        success={removed}
        returnFocus={() => trigger.current}
      />
    </>
  );
}
