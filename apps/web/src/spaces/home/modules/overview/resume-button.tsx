"use client";

import { PlayIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/libs/ui/components/button";
import { resumeAction } from "./actions";

export function ResumeButton({ id }: { readonly id: string }) {
  const [pending, start] = useTransition();
  const [refusal, setRefusal] = useState<string | null>(null);

  function resume() {
    setRefusal(null);
    start(async () => {
      const outcome = await resumeAction(id);

      if (!outcome.ok) {
        setRefusal(outcome.problem.detail);
        return;
      }

      toast.success("Resumed: the run goes on from where it was paused");
    });
  }

  return (
    <span className="relative z-10 flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" disabled={pending} onClick={resume}>
        <PlayIcon data-icon="inline-start" />
        Resume
      </Button>
      {refusal !== null && (
        <span role="alert" className="text-caption text-destructive">
          {refusal}
        </span>
      )}
    </span>
  );
}
