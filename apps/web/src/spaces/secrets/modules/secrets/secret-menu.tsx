"use client";

import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
import { deleteSecretAction } from "./actions";
import { SecretValueDialog } from "./secret-value-dialog";

export const SECRET_TABLE = "secret-table";

interface SecretMenuProps {
  readonly name: string;
  readonly warning: string;
}

export function SecretMenu({ name, warning }: SecretMenuProps) {
  const [replacing, setReplacing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const label = `Actions for ${name}`;
  const title = `Delete the secret ${name}?`;
  const description = `${warning} Its value cannot be recovered after deleting.`;
  const remove = deleteSecretAction.bind(null, name);
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
            onSelect={() => {
              setReplacing(true);
            }}
          >
            <PencilIcon aria-hidden />
            Replace value…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
      <SecretValueDialog
        name={name}
        open={replacing}
        onOpenChange={setReplacing}
        returnFocus={() => trigger.current}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={title}
        description={description}
        actionLabel="Delete secret"
        icon={<Trash2Icon data-icon="inline-start" />}
        action={remove}
        success={removed}
        returnFocus={() => trigger.current}
        doneFocus={() => document.getElementById(SECRET_TABLE)}
      />
    </>
  );
}
