"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Phase } from "@/libs/data-access/types";
import { RUNS_HREF, runsHref, STARTED_WITHIN } from "@/libs/routing/routes";
import { Button } from "@/libs/ui/components/button";
import { Input } from "@/libs/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/libs/ui/components/select";
import { Spinner } from "@/libs/ui/components/spinner";
import { PHASES } from "@/operations/run-progress";
import { PhaseStatus } from "@/features/run-status";
import { PERIODS, RunListQuery } from "./query";

export interface KnownWorkflow {
  readonly namespace: string;
  readonly name: string;
}

const ANY = "any";

type Changes = Partial<Record<keyof RunListQuery, string>>;

export function Filters({
  query,
  filtered,
  workflows,
}: {
  readonly query: RunListQuery;
  readonly filtered: boolean;
  readonly workflows: readonly KnownWorkflow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const workflow =
    query.namespace !== undefined && query.name !== undefined
      ? keyOf(query.namespace, query.name)
      : ANY;

  function apply(changes: Changes) {
    const next = RunListQuery.parse({
      ...query,
      ...changes,
      cursor: undefined,
    });
    const address = runsHref(next);
    start(() => {
      router.replace(address);
    });
  }

  function chooseWorkflow(value: string) {
    const found = workflows.find(
      (each) => keyOf(each.namespace, each.name) === value,
    );
    apply({ namespace: found?.namespace, name: found?.name, version: "" });
  }

  function clear() {
    start(() => {
      router.replace(RUNS_HREF);
    });
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Filters"
    >
      <Select value={workflow} onValueChange={chooseWorkflow}>
        <SelectTrigger aria-label="Workflow" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any workflow</SelectItem>
          {workflows.map((each) => {
            const key = keyOf(each.namespace, each.name);
            return (
              <SelectItem key={key} value={key}>
                {each.name}
                <span className="text-muted-foreground">{each.namespace}</span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <Input
        key={query.version ?? ""}
        aria-label="Version"
        placeholder="Version"
        defaultValue={query.version}
        onBlur={(event) => {
          apply({ version: event.target.value.trim() });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter")
            apply({ version: event.currentTarget.value.trim() });
        }}
        className="w-28"
      />
      <Select
        value={query.phase ?? ANY}
        onValueChange={(phase) => {
          apply({ phase });
        }}
      >
        <SelectTrigger aria-label="Phase" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any phase</SelectItem>
          {PHASES.map((phase: Phase) => (
            <SelectItem key={phase} value={phase}>
              <PhaseStatus phase={phase} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={query.started ?? ANY}
        onValueChange={(started) => {
          apply({ started });
        }}
      >
        <SelectTrigger aria-label="Started" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any time</SelectItem>
          {STARTED_WITHIN.map((each) => (
            <SelectItem key={each} value={each}>
              {PERIODS[each].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filtered && (
        <Button variant="ghost" onClick={clear}>
          <XIcon data-icon="inline-start" />
          Clear filters
        </Button>
      )}
      {pending && (
        <Spinner className="text-muted-foreground" aria-label="Updating" />
      )}
    </div>
  );
}

function keyOf(namespace: string, name: string): string {
  return `${namespace}/${name}`;
}
