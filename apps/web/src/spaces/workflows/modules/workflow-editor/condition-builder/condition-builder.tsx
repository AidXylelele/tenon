"use client";

import { PlusIcon } from "lucide-react";
import type {
  Condition,
  ConditionReading,
  EditAction,
  Join,
} from "language-server/protocol";
import { useId, useState } from "react";
import { Button } from "@/libs/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/libs/ui/components/field";
import { Textarea } from "@/libs/ui/components/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/libs/ui/components/toggle-group";
import { textEditsOf } from "../form-fields";
import {
  type Draft,
  draftOf,
  editsOf,
  holdsReading,
  withJoin,
  withRowAdded,
} from "./condition-rows";
import { BuilderRow } from "./builder-row";
import type { ConditionBuilderProps } from "./interfaces";

const NO_ROWS: Condition = { join: "all", rows: [] };

const JOINS: readonly { readonly join: Join; readonly words: string }[] = [
  { join: "all", words: "All must hold" },
  { join: "any", words: "Any may hold" },
];

const CANNOT_SHOW =
  "The builder cannot show this expression; it stays exactly as written.";

export function ConditionBuilder(props: ConditionBuilderProps) {
  const [last, setLast] = useState(props.reading);

  if (props.reading !== null && props.reading !== last) setLast(props.reading);

  if (last === null)
    return (
      <p className="text-caption text-muted-foreground">
        Reading the condition…
      </p>
    );

  return <ConditionEditor {...props} reading={last} />;
}

function draftOfReading(reading: ConditionReading): Draft {
  const condition = reading.kind === "condition" ? reading.condition : NO_ROWS;
  return draftOf(condition);
}

function ConditionEditor({
  pointer,
  text,
  required,
  labelledBy,
  describedBy,
  reading,
  data,
  renderPicker,
  onEdit,
}: ConditionBuilderProps & { readonly reading: ConditionReading }) {
  const [writing, setWriting] = useState(reading.kind === "expression");
  const [draft, setDraft] = useState(() => draftOfReading(reading));
  const [seen, setSeen] = useState(reading);
  const canBuild = reading.kind === "condition";

  if (seen !== reading) {
    setSeen(reading);

    if (!canBuild) setWriting(true);

    if (canBuild && !holdsReading(draft, reading)) {
      const read = draftOfReading(reading);
      setDraft(read);
    }
  }

  function apply(next: Draft) {
    const edits = editsOf(pointer, next);
    setDraft(next);

    if (edits.length > 0) onEdit(edits);
  }

  function toggle() {
    setWriting(!writing);
  }

  const toggleWords = writing ? "Use the builder" : "Write an expression";
  const showsToggle = !writing || canBuild;

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="flex flex-col gap-3"
    >
      {showsToggle && (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="link"
            size="sm"
            className="px-0"
            onClick={toggle}
          >
            {toggleWords}
          </Button>
        </div>
      )}
      {writing ? (
        <ExpressionField
          pointer={pointer}
          text={text}
          required={required}
          canBuild={canBuild}
          onEdit={onEdit}
        />
      ) : (
        <Rows
          draft={draft}
          data={data}
          renderPicker={renderPicker}
          onDraft={apply}
        />
      )}
    </div>
  );
}

function Rows({
  draft,
  data,
  renderPicker,
  onDraft,
}: Pick<ConditionBuilderProps, "data" | "renderPicker"> & {
  readonly draft: Draft;
  readonly onDraft: (next: Draft) => void;
}) {
  const id = useId();
  const joinId = `${id}-join`;
  const isSeveral = draft.rows.length > 1;

  function add() {
    const next = withRowAdded(draft);
    onDraft(next);
  }

  function join(chosen: string) {
    const picked = JOINS.find((each) => each.join === chosen);

    if (picked === undefined) return;

    const next = withJoin(draft, picked.join);
    onDraft(next);
  }

  return (
    <>
      {isSeveral && (
        <Field>
          <FieldLabel id={joinId}>Conditions</FieldLabel>
          <div>
            <ToggleGroup
              type="single"
              value={draft.join}
              onValueChange={join}
              aria-labelledby={joinId}
            >
              {JOINS.map((each) => (
                <ToggleGroupItem key={each.join} value={each.join}>
                  {each.words}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </Field>
      )}
      <ol className="flex flex-col gap-3">
        {draft.rows.map((row, index) => {
          const position = index + 1;
          return (
            <BuilderRow
              key={row.id}
              draft={draft}
              row={row}
              position={position}
              data={data}
              renderPicker={renderPicker}
              onDraft={onDraft}
            />
          );
        })}
      </ol>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="self-start px-0"
        onClick={add}
      >
        <PlusIcon data-icon="inline-start" />
        Add a condition
      </Button>
    </>
  );
}

function ExpressionField({
  pointer,
  text,
  required,
  canBuild,
  onEdit,
}: {
  readonly pointer: string;
  readonly text: string;
  readonly required: boolean;
  readonly canBuild: boolean;
  readonly onEdit: (actions: readonly EditAction[]) => void;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const noteId = `${id}-note`;
  const describedBy = canBuild ? helpId : `${helpId} ${noteId}`;
  const field = { pointer, required, written: text !== "", value: text };

  function commit(typed: string) {
    if (typed === text) return;

    const edits = textEditsOf(field, typed);

    if (edits.length > 0) onEdit(edits);
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>Condition as an expression</FieldLabel>
      <FieldDescription id={helpId}>
        Written in jq inside {"${ }"}; it holds when its result is true.
      </FieldDescription>
      <Textarea
        key={text}
        id={id}
        rows={2}
        spellCheck={false}
        className="font-mono"
        placeholder="${ .items | length > 0 }"
        defaultValue={text}
        aria-describedby={describedBy}
        onBlur={(event) => {
          commit(event.currentTarget.value);
        }}
      />
      {!canBuild && (
        <p id={noteId} className="text-caption text-muted-foreground">
          {CANNOT_SHOW}
        </p>
      )}
    </Field>
  );
}
