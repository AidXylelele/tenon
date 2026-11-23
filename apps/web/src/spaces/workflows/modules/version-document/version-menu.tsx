"use client";

import { CopyIcon, DownloadIcon, EllipsisIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { IconButton } from "@/libs/ui/composites/icon-button";

export interface VersionSource {
  readonly text: string;
  readonly kind: "YAML" | "JSON";
}

interface VersionMenuProps {
  readonly file: VersionSource;
  readonly download: string;
}

export function VersionMenu({ file, download }: VersionMenuProps) {
  const copyLabel = `Copy ${file.kind}`;
  const downloadLabel = `Download ${file.kind}`;

  function copy() {
    void navigator.clipboard.writeText(file.text).then(
      () => toast.success(`${file.kind} copied`),
      () => toast.error(`The browser did not let Tenon copy the ${file.kind}.`),
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <IconButton label="More actions" icon={EllipsisIcon} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={copy}>
          <CopyIcon aria-hidden />
          {copyLabel}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={download} download>
            <DownloadIcon aria-hidden />
            {downloadLabel}
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
