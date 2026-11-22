"use client";

import type { LSPClient } from "@codemirror/lsp-client";
import type { NewDocumentParam } from "language-server/protocol";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { z } from "zod";
import { reasonOf } from "@/libs/language-client/failures";
import { WORKFLOWS_HREF } from "@/libs/routing/routes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/libs/ui/components/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/libs/ui/components/field";
import { Input } from "@/libs/ui/components/input";
import { Button } from "@/libs/ui/components/button";
import { Spinner } from "@/libs/ui/components/spinner";
import { Time } from "@/libs/ui/composites/time";
import type { DraftRevision, DraftWrite } from "@/libs/data-access/types";
import { newDocumentText } from "@/operations/workflow-language";
import { type DraftStart, NamingFields } from "./form";
import type { NamedDraft, WorkflowName } from "./interfaces";

type Refusals = Partial<Record<NewDocumentParam, ReactNode>>;

const NAME_RULE =
  "1 to 63 letters, digits or hyphens, starting and ending with a letter or a digit. We suggest lowercase.";

const REFUSED: Record<NewDocumentParam, string> = {
  namespace: NAME_RULE,
  name: NAME_RULE,
  version: "Use a version such as 1.0.0.",
};

const FIELDS: readonly {
  readonly key: NewDocumentParam;
  readonly label: string;
  readonly hint: string;
  readonly first: string;
}[] = [
  {
    key: "namespace",
    label: "Namespace",
    hint: "Groups workflows, such as a team or an area: sales, billing.",
    first: "default",
  },
  {
    key: "name",
    label: "Name",
    hint: "Unique in its namespace; it stays for the workflow's life.",
    first: "",
  },
  {
    key: "version",
    label: "First version",
    hint: "Each publish adds a version.",
    first: "1.0.0",
  },
];

export function NamingDialog({
  client,
  userId,
  onNamed,
  onOpen,
}: {
  readonly client: LSPClient;
  readonly userId: string;
  readonly onNamed: (request: DraftStart) => Promise<DraftWrite>;
  readonly onOpen: (name: WorkflowName, revision: DraftRevision) => void;
}) {
  const router = useRouter();
  const [refusals, setRefusals] = useState<Refusals>({});
  const [ownDraft, setOwnDraft] = useState<NamedDraft | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(form: FormData) {
    const fields = Object.fromEntries(form);
    const parsed = NamingFields.safeParse(fields);

    if (!parsed.success) {
      const fields = z.flattenError(parsed.error).fieldErrors;
      setRefusals({
        namespace: fields.namespace?.[0],
        name: fields.name?.[0],
        version: fields.version?.[0],
      });
      return;
    }

    setRefusals({});
    setOwnDraft(null);
    setFailure(null);
    start(async () => {
      try {
        const answer = await newDocumentText(client, parsed.data);

        if (answer.kind === "refused") {
          const found = Object.fromEntries(
            answer.params.map((param) => [param, REFUSED[param]]),
          );
          setRefusals(found);
          return;
        }

        const { namespace, name } = parsed.data;
        const named = { namespace, name };
        const request = { namespace, name, source: answer.text };
        const written = await onNamed(request);

        if (written.kind === "saved") {
          onOpen(named, written.revision);
          return;
        }

        if (written.kind === "refused") {
          setRefusals({ name: written.problem.detail });
          return;
        }

        const current = written.current;
        const own = current?.draft.savedBy.id === userId;
        setRefusals({ name: <TakenName name={named} current={current} /> });
        setOwnDraft(own && current !== null ? { name: named, current } : null);
      } catch (reason) {
        setFailure(reasonOf(reason));
      }
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.push(WORKFLOWS_HREF);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form action={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New workflow</DialogTitle>
            <DialogDescription>
              Name it; the editor opens on its first draft.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {FIELDS.map((each) => {
              const refusal = refusals[each.key];
              const id = `naming-${each.key}`;
              return (
                <Field key={each.key} data-invalid={refusal !== undefined}>
                  <FieldLabel htmlFor={id}>{each.label}</FieldLabel>
                  <Input
                    id={id}
                    name={each.key}
                    defaultValue={each.first}
                    aria-invalid={refusal !== undefined}
                    aria-describedby={`${id}-hint`}
                    autoFocus={each.key === "name"}
                    autoComplete="off"
                  />
                  <FieldDescription id={`${id}-hint`}>
                    {each.hint}
                  </FieldDescription>
                  {refusal !== undefined && <FieldError>{refusal}</FieldError>}
                  {each.key === "name" && ownDraft !== null && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        onOpen(ownDraft.name, ownDraft.current);
                      }}
                    >
                      Open your draft
                    </Button>
                  )}
                </Field>
              );
            })}
          </FieldGroup>
          {failure !== null && (
            <p role="alert" className="text-sm text-destructive">
              {failure}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                router.push(WORKFLOWS_HREF);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner data-icon="inline-start" />}
              Open the editor
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TakenName({
  name,
  current,
}: {
  readonly name: WorkflowName;
  readonly current: DraftRevision | null;
}) {
  const named = `${name.namespace}/${name.name}`;

  if (current === null)
    return <>A draft named {named} exists. Choose another name.</>;

  return (
    <>
      A workflow named {named} is being written by {current.draft.savedBy.name},
      last saved <Time value={current.draft.savedAt} />. Choose another name.
    </>
  );
}
