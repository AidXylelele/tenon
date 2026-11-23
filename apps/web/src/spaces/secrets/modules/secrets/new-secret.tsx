"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/libs/ui/components/button";
import { SecretValueDialog } from "./secret-value-dialog";

export function NewSecret({
  defaultOpen = false,
}: {
  readonly defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        <PlusIcon data-icon="inline-start" />
        New secret
      </Button>
      <SecretValueDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
