"use client";

import { ArrowLeftIcon, FileUpIcon } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { Link } from "@/libs/routing/link";
import { Button } from "@/libs/ui/components/button";
import type { DraftKeeper } from "./draft-keeper";
import { DraftLine } from "./draft-views";
import type { WorkflowName } from "./interfaces";

export function EditorHeader({
  name,
  back,
  keeper,
  userId,
  onLoad,
  children,
}: {
  readonly name: WorkflowName;
  readonly back: string;
  readonly keeper: DraftKeeper;
  readonly userId: string;
  readonly onLoad: (text: string) => void;
  readonly children: ReactNode;
}) {
  const picker = useRef<HTMLInputElement>(null);

  return (
    <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
      <Button variant="ghost" size="icon-sm" asChild>
        <Link href={back} aria-label="Leave the editor">
          <ArrowLeftIcon />
        </Link>
      </Button>
      <div className="min-w-40 flex-1">
        <h1 className="heading-3 truncate">{name.name}</h1>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {name.namespace} · <DraftLine keeper={keeper} userId={userId} />
        </p>
      </div>
      <input
        ref={picker}
        type="file"
        accept=".yaml,.yml,.json"
        className="hidden"
        aria-label="A workflow file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";

          if (file !== undefined) void file.text().then(onLoad);
        }}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          picker.current?.click();
        }}
      >
        <FileUpIcon data-icon="inline-start" />
        <span className="max-sm:sr-only">Load a file</span>
      </Button>
      {children}
    </header>
  );
}
