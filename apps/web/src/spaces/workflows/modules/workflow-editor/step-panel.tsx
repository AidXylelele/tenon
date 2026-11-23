"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CodeIcon,
  CopyIcon,
  EllipsisIcon,
  PanelRightIcon,
  RepeatIcon,
  ShieldIcon,
  SquareStackIcon,
  Trash2Icon,
} from "lucide-react";
import type {
  EditAction,
  Step,
  StepFormResult,
  StepVariant,
} from "language-server/protocol";
import { Button } from "@/libs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/libs/ui/components/dropdown-menu";
import { Spinner } from "@/libs/ui/components/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/libs/ui/components/tooltip";
import { PanelHeader } from "@/libs/ui/composites/panel-header";
import { type SlotSources, useFormSlots } from "./form-slots";
import { catalogOf } from "./step-catalog";
import { type Edit, StepForm } from "./step-form";
import type { StepPlace } from "./steps";

interface StepPanelProps {
  readonly step: Step;
  readonly form: StepFormResult | null;
  readonly protection: StepFormResult | null;
  readonly formless: boolean;
  readonly place: StepPlace | null;
  readonly variants: readonly StepVariant[];
  readonly revealProblems: boolean;
  readonly languageTerms: boolean;
  readonly sources: SlotSources;
  readonly onLanguageTerms: (shown: boolean) => void;
  readonly onRemove: (step: string) => void;
  readonly onClose: () => void;
}

interface StepMenuProps {
  readonly step: Step;
  readonly place: StepPlace | null;
  readonly onEdit: Edit;
  readonly onRemove: (step: string) => void;
}

type Block = Extract<EditAction, { readonly kind: "wrapSteps" }>["block"];

const TITLE_ID = "step-panel-title";

const WRAPS: readonly {
  readonly block: Block;
  readonly words: string;
  readonly icon: typeof ShieldIcon;
}[] = [
  { block: "try", words: "Wrap in Try (retry if it fails)", icon: ShieldIcon },
  { block: "for", words: "Wrap in Repeat for each item", icon: RepeatIcon },
  { block: "do", words: "Wrap in a group", icon: SquareStackIcon },
];

export function StepPanel({
  step,
  form,
  protection,
  formless,
  place,
  variants,
  revealProblems,
  languageTerms,
  sources,
  onLanguageTerms,
  onRemove,
  onClose,
}: StepPanelProps) {
  const slots = useFormSlots(sources);
  const entries = catalogOf(variants, null).flatMap((group) => group.entries);
  const entry = entries.find((each) => each.id === step.variant);
  const kind = entry?.title ?? step.kind;
  const term = languageTerms && entry !== undefined ? entry.languageTerm : null;
  const subtitle = term === null ? kind : `${kind} · ${term}`;
  const wide = sources.wide;

  return (
    <section
      aria-labelledby={TITLE_ID}
      className="flex min-h-0 flex-1 flex-col"
    >
      <PanelHeader
        title={step.name}
        titleId={TITLE_ID}
        subtitle={subtitle}
        onClose={onClose}
        actions={
          <>
            <Toggle
              label="Show language terms"
              pressed={languageTerms}
              onPressed={onLanguageTerms}
            >
              <CodeIcon aria-hidden />
            </Toggle>
            <Toggle
              label="Wider panel"
              pressed={wide}
              onPressed={sources.onWide}
            >
              <PanelRightIcon aria-hidden />
            </Toggle>
            <StepMenu
              step={step}
              place={place}
              onEdit={sources.onEdit}
              onRemove={onRemove}
            />
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {form !== null && (
          <StepForm
            step={step}
            form={form}
            protection={protection}
            revealProblems={revealProblems}
            languageTerms={languageTerms}
            onEdit={sources.onEdit}
            {...slots}
          />
        )}
        {form === null && !formless && (
          <p
            role="status"
            className="flex items-center gap-2 text-caption text-muted-foreground"
          >
            <Spinner />
            Reading the step…
          </p>
        )}
        {formless && (
          <p className="text-caption text-muted-foreground">
            This step cannot be shown as a form while the text does not read;
            change it in Code.
          </p>
        )}
      </div>
    </section>
  );
}

function Toggle({
  label,
  pressed,
  onPressed,
  children,
}: {
  readonly label: string;
  readonly pressed: boolean;
  readonly onPressed: (pressed: boolean) => void;
  readonly children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          onClick={() => {
            onPressed(!pressed);
          }}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function StepMenu({ step, place, onEdit, onRemove }: StepMenuProps) {
  const isFirst = place === null || place.index === 0;
  const isLast = place === null || place.index === place.size - 1;

  function move(by: -1 | 1) {
    if (place === null) return;

    const index = place.index + by;
    const action: EditAction = {
      kind: "moveStep",
      step: step.id,
      list: place.list,
      index,
    };
    onEdit([action]);
  }

  function wrap(block: Block) {
    const action: EditAction = {
      kind: "wrapSteps",
      steps: [step.id],
      block,
      name: null,
    };
    onEdit([action]);
  }

  return (
    <DropdownMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Step actions"
            >
              <EllipsisIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Step actions</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            onEdit([{ kind: "duplicateStep", step: step.id }]);
          }}
        >
          <CopyIcon />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isFirst}
          onSelect={() => {
            move(-1);
          }}
        >
          <ArrowUpIcon />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isLast}
          onSelect={() => {
            move(1);
          }}
        >
          <ArrowDownIcon />
          Move down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {WRAPS.map((each) => (
          <DropdownMenuItem
            key={each.block}
            onSelect={() => {
              wrap(each.block);
            }}
          >
            <each.icon />
            {each.words}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            onRemove(step.id);
          }}
        >
          <Trash2Icon />
          Delete step
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
