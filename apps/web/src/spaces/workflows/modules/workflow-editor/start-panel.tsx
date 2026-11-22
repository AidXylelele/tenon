"use client";

import { CrosshairIcon, XIcon } from "lucide-react";
import { FormSections } from "@/libs/forms/form-sections";
import { Button } from "@/libs/ui/components/button";
import { triggerText } from "@/operations/schedule-words";
import type { StartPanelProps } from "./interfaces";

export function StartPanel({
  triggers,
  form,
  formless,
  onShow,
  onEdit,
  onClose,
}: StartPanelProps) {
  return (
    <section aria-label="Start" className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="heading-3">Start</h2>
          <p className="text-xs text-muted-foreground">
            How the workflow starts, its title and its input
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close the start"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
        {triggers.length === 0 ? (
          <p className="text-sm">By hand, or when an application starts it.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {triggers.map((trigger) => (
              <li key={trigger.pointer} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">{triggerText(trigger)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onShow(trigger);
                  }}
                >
                  <CrosshairIcon data-icon="inline-start" />
                  Show in the text
                </Button>
              </li>
            ))}
          </ul>
        )}
        {formless && (
          <p className="text-sm text-muted-foreground" role="status">
            The text has a problem the language service cannot read past. Fix it
            to change the start here.
          </p>
        )}
        {form !== null && <FormSections fields={form.fields} onEdit={onEdit} />}
      </div>
    </section>
  );
}
