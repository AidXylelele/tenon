"use client";

import { EllipsisIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { ConfirmDialog } from "@/libs/ui/composites/confirm-dialog";
import { IconButton } from "@/libs/ui/composites/icon-button";
import { revokeAction } from "./actions";

export function InvitationMenu({
  id,
  email,
}: {
  readonly id: string;
  readonly email: string;
}) {
  const [revoking, setRevoking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const label = `More actions for ${email}`;
  const title = `Revoke the invitation for ${email}?`;
  const revoke = revokeAction.bind(null, id);
  const revoked = `Invitation for ${email} revoked`;

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <IconButton ref={trigger} label={label} icon={EllipsisIcon} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setRevoking(true);
            }}
          >
            <XIcon aria-hidden />
            Revoke invitation…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={revoking}
        onOpenChange={setRevoking}
        title={title}
        description="The link stops working. You can invite the address again."
        actionLabel="Revoke invitation"
        icon={<XIcon data-icon="inline-start" />}
        action={revoke}
        success={revoked}
        returnFocus={() => trigger.current}
      />
    </>
  );
}
