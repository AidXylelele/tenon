"use client";

import {
  ArrowLeftIcon,
  CodeIcon,
  DownloadIcon,
  EllipsisIcon,
  PlayIcon,
  TriangleAlertIcon,
  UploadIcon,
  WorkflowIcon,
} from "lucide-react";
import { type ReactNode, useRef } from "react";
import { Link } from "@/libs/routing/link";
import { Button } from "@/libs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/libs/ui/components/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/libs/ui/components/tooltip";
import type { CodeShown } from "./interfaces";

interface EditorToolbarProps {
  readonly title: string;
  readonly back: string;
  readonly status: ReactNode;
  readonly shown: CodeShown;
  readonly problems: number;
  readonly testing: boolean;
  readonly onShown: (shown: CodeShown) => void;
  readonly onProblems: () => void;
  readonly onTest: () => void;
  readonly onLoad: (text: string) => void;
  readonly onDownload: () => void;
  readonly children: ReactNode;
}

const BACK = "Back to the workflow";

export function EditorToolbar({
  title,
  back,
  status,
  shown,
  problems,
  testing,
  onShown,
  onProblems,
  onTest,
  onLoad,
  onDownload,
  children,
}: EditorToolbarProps) {
  const picker = useRef<HTMLInputElement>(null);
  const counted = problems === 1 ? "1 problem" : `${String(problems)} problems`;

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b px-3 py-2 max-lg:grid-cols-1">
      <div className="flex min-w-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild>
              <Link href={back} aria-label={BACK}>
                <ArrowLeftIcon aria-hidden />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{BACK}</TooltipContent>
        </Tooltip>
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-body font-semibold">{title}</h1>
          <p className="truncate text-caption text-muted-foreground">
            {status}
          </p>
        </div>
      </div>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={shown}
        aria-label="View"
        onValueChange={(value) => {
          if (value === "flow" || value === "code") onShown(value);
        }}
      >
        <ToggleGroupItem value="flow">
          <WorkflowIcon aria-hidden />
          Flow
        </ToggleGroupItem>
        <ToggleGroupItem value="code">
          <CodeIcon aria-hidden />
          Code
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {problems > 0 && (
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={onProblems}
          >
            <TriangleAlertIcon data-icon="inline-start" />
            {counted}
          </Button>
        )}
        <Button variant="outline" disabled={testing} onClick={onTest}>
          <PlayIcon data-icon="inline-start" />
          Test run
        </Button>
        {children}
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
        <DropdownMenu modal={false}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="More actions">
                  <EllipsisIcon aria-hidden />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More actions</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => {
                picker.current?.click();
              }}
            >
              <UploadIcon />
              Load a file…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDownload}>
              <DownloadIcon />
              Download YAML
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
