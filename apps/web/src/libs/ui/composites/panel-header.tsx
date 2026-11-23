import { ChevronLeftIcon, XIcon } from "lucide-react";
import { Button } from "../components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../components/tooltip";

interface PanelHeaderProps {
  readonly title: string;
  readonly titleId?: string;
  readonly subtitle?: React.ReactNode;
  readonly onBack?: () => void;
  readonly backLabel?: string;
  readonly actions?: React.ReactNode;
  readonly onClose?: () => void;
}

interface HeaderButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}

function HeaderButton({ label, onClick, children }: HeaderButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
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
        <HeaderButton label={backLabel} onClick={onBack}>
          <ChevronLeftIcon />
        </HeaderButton>
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
        <HeaderButton label="Close" onClick={onClose}>
          <XIcon />
        </HeaderButton>
      )}
    </header>
  );
}
