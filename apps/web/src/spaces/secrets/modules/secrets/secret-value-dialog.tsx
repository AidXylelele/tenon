"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Problem } from "@/libs/data-access/problem";
import { Button } from "@/libs/ui/components/button";
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
  FieldGroup,
  FieldLabel,
} from "@/libs/ui/components/field";
import { Input } from "@/libs/ui/components/input";
import { Label } from "@/libs/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/libs/ui/components/radio-group";
import { Spinner } from "@/libs/ui/components/spinner";
import { ProblemMessage } from "@/libs/ui/composites/problem-message";
import { createSecretAction, replaceSecretAction } from "./actions";

type Shape = "text" | "basic" | "bearer";

const SHAPES: readonly { readonly value: Shape; readonly label: string }[] = [
  { value: "text", label: "Text" },
  { value: "basic", label: "A username and a password" },
  { value: "bearer", label: "A bearer token" },
];

interface SecretValueDialogProps {
  readonly name?: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

function isShape(value: string): value is Shape {
  return SHAPES.some((shape) => shape.value === value);
}

function valueOf(
  shape: Shape,
  text: string,
  username: string,
  password: string,
): string {
  if (shape === "basic") return JSON.stringify({ username, password });

  if (shape === "bearer") return JSON.stringify({ token: text });

  return text;
}

export function SecretValueDialog({
  name,
  open,
  onOpenChange,
}: SecretValueDialogProps) {
  const replacing = name !== undefined;
  const [chosen, setChosen] = useState("");
  const [shape, setShape] = useState<Shape>("text");
  const [text, setText] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, start] = useTransition();
  const first = useRef<HTMLInputElement>(null);
  const basic = shape === "basic";
  const empty = basic ? password === "" : text === "";
  const title = replacing ? `Replace the value of ${name}` : "New secret";
  const submitLabel = replacing ? "Replace value" : "Save secret";
  const textLabel = shape === "bearer" ? "Token" : "Value";

  function change(next: boolean) {
    onOpenChange(next);

    if (next) return;

    setChosen("");
    setText("");
    setUsername("");
    setPassword("");
    setProblem(null);
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const secretName = name ?? chosen.trim();
    const value = valueOf(shape, text, username, password);
    setProblem(null);
    start(async () => {
      const outcome = replacing
        ? await replaceSecretAction(secretName, value)
        : await createSecretAction(secretName, value);

      if (!outcome.ok) {
        setProblem(outcome.problem);
        return;
      }

      const done = replacing
        ? `${secretName} replaced; the next runs use the new value`
        : `${secretName} saved`;
      toast.success(done);
      change(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          first.current?.focus();
        }}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Kept encrypted and read only while a run needs it. Runs record it
              as ***; it is never shown again after it is saved.
            </DialogDescription>
          </DialogHeader>
          <ProblemMessage problem={problem} />
          <FieldGroup>
            {!replacing && (
              <Field>
                <FieldLabel htmlFor="secret-name">Name</FieldLabel>
                <FieldDescription>
                  Letters, digits, dashes and underscores, such as
                  CRM_API_TOKEN. Steps pick it by this name.
                </FieldDescription>
                <Input
                  ref={first}
                  id="secret-name"
                  value={chosen}
                  onChange={(change) => {
                    setChosen(change.target.value);
                  }}
                  required
                  pattern="[A-Za-z0-9_\-]{1,120}"
                  autoComplete="off"
                  className="font-mono"
                />
              </Field>
            )}
            <Field>
              <FieldLabel id="secret-shape">What it holds</FieldLabel>
              <RadioGroup
                value={shape}
                onValueChange={(next) => {
                  if (isShape(next)) setShape(next);
                }}
                aria-labelledby="secret-shape"
              >
                {SHAPES.map((each) => {
                  const id = `secret-shape-${each.value}`;
                  return (
                    <div key={each.value} className="flex items-center gap-2">
                      <RadioGroupItem id={id} value={each.value} />
                      <Label htmlFor={id}>{each.label}</Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </Field>
            {basic ? (
              <>
                <Field>
                  <FieldLabel htmlFor="secret-username">Username</FieldLabel>
                  <Input
                    ref={replacing ? first : undefined}
                    id="secret-username"
                    value={username}
                    onChange={(change) => {
                      setUsername(change.target.value);
                    }}
                    required
                    autoComplete="off"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="secret-password">Password</FieldLabel>
                  <Input
                    id="secret-password"
                    type="password"
                    value={password}
                    onChange={(change) => {
                      setPassword(change.target.value);
                    }}
                    required
                    autoComplete="new-password"
                  />
                </Field>
              </>
            ) : (
              <Field>
                <FieldLabel htmlFor="secret-value">{textLabel}</FieldLabel>
                <Input
                  ref={replacing ? first : undefined}
                  id="secret-value"
                  type="password"
                  value={text}
                  onChange={(change) => {
                    setText(change.target.value);
                  }}
                  required
                  maxLength={16384}
                  autoComplete="new-password"
                  className="font-mono"
                />
                <FieldDescription>
                  Hidden as you type; Tenon never shows it again.
                </FieldDescription>
              </Field>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                change(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || empty}
              aria-busy={pending}
            >
              {pending && <Spinner data-icon="inline-start" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
