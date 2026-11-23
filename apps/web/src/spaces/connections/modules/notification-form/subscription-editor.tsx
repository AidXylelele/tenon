"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { codeOf, type Problem } from "@/libs/data-access/problem";
import type { DeliveryScheme, Endpoint } from "@/libs/data-access/types";
import type { JsonObject, JsonValue } from "@/libs/json/json";
import { Link } from "@/libs/routing/link";
import {
  NEW_SECRET_HREF,
  notificationHref,
  NOTIFICATIONS_HREF,
} from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/libs/ui/components/field";
import { Input } from "@/libs/ui/components/input";
import { Label } from "@/libs/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@/libs/ui/components/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/libs/ui/components/select";
import { Spinner } from "@/libs/ui/components/spinner";
import { Disclosure } from "@/libs/ui/composites/disclosure";
import { ProblemMessage } from "@/libs/ui/composites/problem-message";
import { createSubscriptionAction } from "./actions";
import { AttributeRows } from "./attribute-rows";
import type { AttributeRow, SubscriptionEditorProps } from "./interfaces";

const NONE = "none";
const CUSTOM = "custom";
const TYPE_POINTER = "/filter/with/type";
const DATA_IS_AN_OBJECT = "Data is matched by a JSON object it must contain.";

type Scheme = DeliveryScheme | typeof NONE;

function isScheme(value: string): value is Scheme {
  return value === NONE || value === "basic" || value === "bearer";
}

function valueOf(row: AttributeRow): JsonValue | undefined {
  const text = row.value.trim();

  if (row.attribute !== "data") return text;

  if (text.startsWith("${")) return text;

  try {
    const parsed = JSON.parse(text) as JsonValue;
    const object =
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed);
    return object ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function pointsAt(problem: Problem | null, pointer: string): string | null {
  const located = problem?.errors.find(
    (error) =>
      error.pointer === pointer || error.pointer.startsWith(`${pointer}/`),
  );
  return located?.detail ?? null;
}

export function SubscriptionEditor({
  secretNames,
  presets,
}: SubscriptionEditorProps) {
  const router = useRouter();
  const firstPreset = presets.at(0)?.value ?? CUSTOM;
  const [name, setName] = useState("");
  const [uri, setUri] = useState("https://");
  const [scheme, setScheme] = useState<Scheme>(NONE);
  const [secret, setSecret] = useState(secretNames.at(0) ?? "");
  const [when, setWhen] = useState(firstPreset);
  const [customType, setCustomType] = useState("");
  const [rows, setRows] = useState<readonly AttributeRow[]>([]);
  const [rowErrors, setRowErrors] = useState<Readonly<Record<string, string>>>(
    {},
  );
  const [problem, setProblem] = useState<Problem | null>(null);
  const [pending, start] = useTransition();
  const code = problem === null ? null : codeOf(problem);
  const foreign = code === "subscription.foreign-secret";
  const refusedEndpoint = code === "subscription.private-endpoint";
  const custom = when === CUSTOM;
  const typeRefusal = pointsAt(problem, TYPE_POINTER);
  const typeInvalid = custom && typeRefusal !== null;
  const placed = refusedEndpoint || foreign || typeInvalid;

  function rowError(row: AttributeRow): string | null {
    const pointer = `/filter/with/${row.attribute}`;
    return rowErrors[row.id] ?? pointsAt(problem, pointer);
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const type = custom ? customType.trim() : when;
    const filter: JsonObject = { type };
    const errors: Record<string, string> = {};

    rows.forEach((row) => {
      if (row.value.trim() === "") return;

      const value = valueOf(row);

      if (value === undefined) errors[row.id] = DATA_IS_AN_OBJECT;
      else filter[row.attribute] = value;
    });
    setRowErrors(errors);

    if (Object.keys(errors).length > 0) return;

    const endpoint: Endpoint =
      scheme === NONE ? { uri } : { uri, authentication: { scheme, secret } };
    const trimmed = name.trim();
    const matching = { with: filter };
    setProblem(null);
    start(async () => {
      const outcome = await createSubscriptionAction(
        trimmed,
        endpoint,
        matching,
      );

      if (!outcome.ok) {
        setProblem(outcome.problem);
        return;
      }

      const created = notificationHref(outcome.value.id);
      toast.success(`${outcome.value.name} created`, {
        description: "Matching events are delivered from now on.",
      });
      router.push(created);
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex max-w-(--form-width-max) flex-col gap-6"
    >
      {!placed && <ProblemMessage problem={problem} />}
      <FieldSet className="border-t pt-4">
        <FieldLegend>Send to</FieldLegend>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="subscription-name">Name</FieldLabel>
            <FieldDescription>
              Shown in the list, for example “On-call channel”.
            </FieldDescription>
            <Input
              id="subscription-name"
              value={name}
              onChange={(change) => {
                setName(change.target.value);
              }}
              required
              maxLength={120}
              autoFocus
            />
          </Field>
          <Field data-invalid={refusedEndpoint}>
            <FieldLabel htmlFor="subscription-uri">Address</FieldLabel>
            <FieldDescription>
              Tenon sends a POST request with the event as JSON and tries again
              for about a day when it is refused. Private networks are refused.
            </FieldDescription>
            <Input
              id="subscription-uri"
              value={uri}
              onChange={(change) => {
                setUri(change.target.value);
              }}
              required
              type="url"
              className="font-mono"
              aria-invalid={refusedEndpoint}
            />
            {refusedEndpoint && <FieldError>{problem?.detail}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="subscription-auth">
              Authentication{" "}
              <span className="font-normal text-muted-foreground">
                optional
              </span>
            </FieldLabel>
            <FieldDescription>
              Use a secret for a token or a password.
            </FieldDescription>
            <Select
              value={scheme}
              onValueChange={(next) => {
                if (isScheme(next)) setScheme(next);
              }}
            >
              <SelectTrigger id="subscription-auth" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                <SelectItem value="basic">Basic, from a secret</SelectItem>
                <SelectItem value="bearer">
                  Bearer token, from a secret
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {scheme !== NONE && (
            <Field data-invalid={foreign}>
              <FieldLabel htmlFor="subscription-secret">Secret</FieldLabel>
              {secretNames.length === 0 ? (
                <FieldDescription>
                  You have no secrets yet.{" "}
                  <Link
                    href={NEW_SECRET_HREF}
                    className="text-accent-text underline underline-offset-4"
                  >
                    Add one
                  </Link>{" "}
                  first.
                </FieldDescription>
              ) : (
                <Select value={secret} onValueChange={setSecret}>
                  <SelectTrigger id="subscription-secret" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {secretNames.map((each) => (
                      <SelectItem key={each} value={each}>
                        {each}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {foreign && <FieldError>{problem?.detail}</FieldError>}
            </Field>
          )}
        </FieldGroup>
      </FieldSet>
      <FieldSet className="border-t pt-4">
        <FieldLegend>When</FieldLegend>
        <RadioGroup value={when} onValueChange={setWhen} aria-label="When">
          {presets.map((preset) => {
            const id = `when-${preset.value}`;
            return (
              <div key={preset.value} className="flex items-center gap-2">
                <RadioGroupItem id={id} value={preset.value} />
                <Label htmlFor={id}>{preset.label}</Label>
              </div>
            );
          })}
          <div className="flex items-center gap-2">
            <RadioGroupItem id="when-custom" value={CUSTOM} />
            <Label htmlFor="when-custom">An event of a type I choose</Label>
          </div>
        </RadioGroup>
        {custom && (
          <Field data-invalid={typeInvalid}>
            <FieldLabel htmlFor="subscription-type">Event type</FieldLabel>
            <FieldDescription>
              Matched whole, as a regular expression, such as com\.example\..*
            </FieldDescription>
            <Input
              id="subscription-type"
              value={customType}
              onChange={(change) => {
                setCustomType(change.target.value);
              }}
              required
              className="font-mono"
              aria-invalid={typeInvalid}
            />
            {typeInvalid && <FieldError>{typeRefusal}</FieldError>}
          </Field>
        )}
      </FieldSet>
      <Disclosure
        title="More options"
        summary="Match other event attributes exactly"
      >
        <Field>
          <FieldDescription>
            For example source = /sales. Values are regular expressions or
            expressions such as {"${ . > 100 }"}; data matches a JSON object it
            contains. Every attribute must match.
          </FieldDescription>
          <AttributeRows rows={rows} errorOf={rowError} onChange={setRows} />
        </Field>
      </Disclosure>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" asChild>
          <Link href={NOTIFICATIONS_HREF}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending && <Spinner data-icon="inline-start" />}
          Create notification
        </Button>
      </div>
    </form>
  );
}
