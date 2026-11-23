"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/libs/ui/components/button";
import { Field, FieldError } from "@/libs/ui/components/field";
import { Input } from "@/libs/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/libs/ui/components/select";
import { type Attribute, ATTRIBUTES, type AttributeRow } from "./interfaces";

interface AttributeRowsProps {
  readonly rows: readonly AttributeRow[];
  readonly errorOf: (row: AttributeRow) => string | null;
  readonly onChange: (rows: readonly AttributeRow[]) => void;
}

function isAttribute(value: string): value is Attribute {
  return ATTRIBUTES.some((attribute) => attribute === value);
}

export function AttributeRows({ rows, errorOf, onChange }: AttributeRowsProps) {
  function changed(id: string, next: Partial<AttributeRow>) {
    const updated = rows.map((row) =>
      row.id === id ? { ...row, ...next } : row,
    );
    onChange(updated);
  }

  function add() {
    const row: AttributeRow = {
      id: crypto.randomUUID(),
      attribute: "source",
      value: "",
    };
    onChange(rows.concat(row));
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => {
        const error = errorOf(row);
        const invalid = error !== null;
        const placeholder =
          row.attribute === "data" ? '{ "status": "paid" }' : "/sales";
        const remove = `Remove the ${row.attribute} attribute`;

        return (
          <Field key={row.id} data-invalid={invalid}>
            <div className="flex gap-2">
              <Select
                value={row.attribute}
                onValueChange={(attribute) => {
                  if (isAttribute(attribute)) changed(row.id, { attribute });
                }}
              >
                <SelectTrigger className="w-40" aria-label="Attribute">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATTRIBUTES.map((attribute) => (
                    <SelectItem key={attribute} value={attribute}>
                      {attribute}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label={`${row.attribute} matches`}
                aria-invalid={invalid}
                value={row.value}
                onChange={(change) => {
                  changed(row.id, { value: change.target.value });
                }}
                className="flex-1 font-mono"
                placeholder={placeholder}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={remove}
                onClick={() => {
                  onChange(rows.filter((each) => each.id !== row.id));
                }}
              >
                <XIcon />
              </Button>
            </div>
            {invalid && <FieldError>{error}</FieldError>}
          </Field>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={add}
      >
        <PlusIcon data-icon="inline-start" />
        Add an attribute to match
      </Button>
    </div>
  );
}
