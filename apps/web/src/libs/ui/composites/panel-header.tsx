import { ChevronLeftIcon, XIcon } from "lucide-react";
import { IconButton } from "./icon-button";

interface PanelHeaderProps {
  readonly title: string;
  readonly titleId?: string;
  readonly subtitle?: React.ReactNode;
  readonly onBack?: () => void;
  readonly backLabel?: string;
  readonly actions?: React.ReactNode;
  readonly onClose?: () => void;
}

export function PanelHeader({
  title,
  titleId,
  subtitle,
  onBack,
  backLabel = "Back",
  actions,
  onClose,
}: PanelHeaderProps) {
  return (
    <header className="flex items-start gap-2.5 border-b border-border px-4 py-3">
      {onBack !== undefined && (
        <IconButton
          type="button"
          label={backLabel}
          icon={ChevronLeftIcon}
          onClick={onBack}
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <h2 id={titleId} className="truncate text-body font-semibold">
          {title}
        </h2>
        {subtitle !== undefined && (
          <div className="text-caption text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {actions}
      {onClose !== undefined && (
        <IconButton
          type="button"
          label="Close"
          icon={XIcon}
          onClick={onClose}
        />
      )}
    </header>
  );
}
