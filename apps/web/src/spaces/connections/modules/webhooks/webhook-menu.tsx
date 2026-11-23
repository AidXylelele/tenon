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
import { deleteWebhookAction } from "./actions";

export const WEBHOOK_TABLE = "webhook-table";

interface WebhookMenuProps {
  readonly id: string;
  readonly name: string;
}

export function WebhookMenu({ id, name }: WebhookMenuProps) {
  const [deleting, setDeleting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const label = `Actions for ${name}`;
  const title = `Delete the webhook ${name}?`;
  const remove = deleteWebhookAction.bind(null, id);
  const removed = `${name} deleted`;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton
            ref={trigger}
            label={label}
            icon={EllipsisIcon}
            size="icon-sm"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setDeleting(true);
            }}
          >
            <Trash2Icon aria-hidden />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={title}
        description="Its URL stops working at once; calls to it are refused as unknown."
        actionLabel="Delete webhook"
        icon={<Trash2Icon data-icon="inline-start" />}
        action={remove}
        success={removed}
        returnFocus={() => trigger.current}
        doneFocus={() => document.getElementById(WEBHOOK_TABLE)}
      />
    </>
  );
}
