"use client";

import { CircleAlertIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Link } from "@/libs/routing/link";
import { NEW_WORKFLOW_HREF } from "@/libs/routing/routes";
import { Alert, AlertDescription } from "@/libs/ui/components/alert";
import { Button } from "@/libs/ui/components/button";
import { Spinner } from "@/libs/ui/components/spinner";
import { startFromTemplateAction } from "./actions";
import { type Template, TEMPLATES } from "./templates";

const FIRST = 3;

export function TemplateGallery() {
  const [all, setAll] = useState(false);
  const [using, setUsing] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const shown = all ? TEMPLATES : TEMPLATES.slice(0, FIRST);

  function use(template: Template) {
    setUsing(template.id);
    setRefusal(null);
    start(async () => {
      const refused = await startFromTemplateAction(template.id);
      setRefusal(refused);
    });
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {refusal !== null && (
        <Alert variant="destructive" className="max-w-xl">
          <CircleAlertIcon />
          <AlertDescription>{refusal}</AlertDescription>
        </Alert>
      )}
      <ul
        aria-label="Templates"
        className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {shown.map((template) => (
          <li key={template.id} className="flex">
            <TemplateCard
              template={template}
              busy={pending && using === template.id}
              disabled={pending}
              onUse={use}
            />
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap items-center justify-center gap-x-2 text-body">
        {!all && (
          <>
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => {
                setAll(true);
              }}
            >
              See all five templates
            </Button>
            <span className="text-muted-foreground">or</span>
          </>
        )}
        <Button variant="link" className="h-auto p-0" asChild>
          <Link href={NEW_WORKFLOW_HREF}>start from scratch</Link>
        </Button>
      </p>
    </div>
  );
}

function TemplateCard({
  template,
  busy,
  disabled,
  onUse,
}: {
  readonly template: Template;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onUse: (template: Template) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={busy}
      onClick={() => {
        onUse(template);
      }}
      className="flex w-full flex-col gap-2 rounded-lg border bg-card p-4 text-left transition-colors duration-(--duration-fast) ease-standard hover:border-border-strong disabled:opacity-70"
    >
      <span className="text-body font-semibold">{template.title}</span>
      <span className="text-caption text-muted-foreground">
        {template.description}
      </span>
      <span aria-hidden className="flex flex-col gap-1 py-1">
        {template.steps.map((step) => {
          const Icon = step.icon;
          return (
            <span
              key={step.words}
              className="flex items-center gap-1.5 text-caption text-muted-foreground"
            >
              <Icon className="size-3.5" />
              {step.words}
            </span>
          );
        })}
      </span>
      <span className="mt-auto flex items-center gap-1.5 text-body font-semibold text-accent-text">
        {busy && <Spinner className="size-4" />}
        Use this template →
      </span>
    </button>
  );
}
