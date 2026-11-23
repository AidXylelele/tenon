"use client";

import { PlusIcon } from "lucide-react";
import { useAddressState } from "@/libs/routing/address-state";
import { FLAG } from "@/libs/routing/flag";
import { Button } from "@/libs/ui/components/button";
import { SecretValueDialog } from "./secret-value-dialog";

const NEW = "new";

export function NewSecret() {
  const address = useAddressState();
  const open = address.flagged(NEW);

  return (
    <SecretValueDialog
      open={open}
      onOpenChange={(next) => {
        const flag = next ? FLAG : null;
        address.change({ [NEW]: flag });
      }}
      trigger={
        <Button>
          <PlusIcon data-icon="inline-start" />
          New secret
        </Button>
      }
    />
  );
}
