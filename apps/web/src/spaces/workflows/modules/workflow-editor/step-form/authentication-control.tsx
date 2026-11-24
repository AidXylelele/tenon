"use client";

import { useState } from "react";
import { Input } from "@/libs/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/libs/ui/components/select";
import {
  type Authentication,
  authenticationEditsOf,
  authenticationOf,
} from "../form-fields";
import { blurOnEnter } from "./field-shell";
import { useFormSettings } from "./form-settings";
import type { ControlProps } from "./value-controls";

const SCHEMES: readonly {
  readonly scheme: Authentication["scheme"];
  readonly words: string;
}[] = [
  { scheme: "none", words: "None" },
  { scheme: "bearer", words: "A bearer token from a secret" },
  { scheme: "basic", words: "A user name and password from a secret" },
];

const WRITTEN_OTHERWISE = "As written in the text";

export function AuthenticationControl({ field, wiring }: ControlProps) {
  const { onEdit } = useFormSettings();
  const written = authenticationOf(field.value);
  const [chosen, setChosen] = useState(written);
  const secretId = `${wiring.id}-secret`;
  const needsSecret = chosen.scheme === "bearer" || chosen.scheme === "basic";

  function choose(scheme: string) {
    const picked = SCHEMES.find((each) => each.scheme === scheme);

    if (picked === undefined) return;

    const next = { scheme: picked.scheme, secret: chosen.secret };
    setChosen(next);
    const edits = authenticationEditsOf(field, next);

    if (edits.length > 0) onEdit(edits);
  }

  function name(secret: string) {
    const next = { scheme: chosen.scheme, secret };
    setChosen(next);

    if (secret.trim() === written.secret) return;

    const edits = authenticationEditsOf(field, next);

    if (edits.length > 0) onEdit(edits);
  }

  return (
    <div className="flex flex-col gap-2">
      <Select value={chosen.scheme} onValueChange={choose}>
        <SelectTrigger
          id={wiring.id}
          className="w-full"
          aria-describedby={wiring.describedBy}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCHEMES.map((each) => (
            <SelectItem key={each.scheme} value={each.scheme}>
              {each.words}
            </SelectItem>
          ))}
          {chosen.scheme === "other" && (
            <SelectItem value="other" disabled>
              {WRITTEN_OTHERWISE}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {needsSecret && (
        <Input
          key={written.secret}
          id={secretId}
          aria-label="The secret's name"
          className="font-mono placeholder:text-faint"
          placeholder="API_TOKEN"
          defaultValue={chosen.secret}
          onBlur={(event) => {
            name(event.currentTarget.value);
          }}
          onKeyDown={blurOnEnter}
        />
      )}
    </div>
  );
}
