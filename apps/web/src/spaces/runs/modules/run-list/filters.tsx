"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RUNS_HREF } from "@/libs/routing/routes";
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
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/libs/ui/components/toggle-group";
import {
  periodLabel,
  type RunStatus,
  STARTED,
  type Started,
  startedOf,
  STATUSES,
  statusesOf,
  statusLabel,
  type TimeWindow,
  windowPhrase,
} from "@/operations/run-periods";
import { phaseLabel } from "@/operations/run-progress";
import { isFiltered, type RunsAddress, runsHrefOf } from "./runs-address";

export interface KnownWorkflow {
  readonly namespace: string;
  readonly name: string;
}

const ANY = "any";

type Changes = Partial<RunsAddress>;

export function Filters({
  address,
  workflows,
  zone,
}: {
  readonly address: RunsAddress;
  readonly workflows: readonly KnownWorkflow[];
  readonly zone: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const filtered = isFiltered(address);
  const workflow = keyOf(address.namespace, address.name);
  const chosen = address.statuses.slice();
  const startedChoice = address.between === null ? address.started : "";

  function apply(changes: Changes) {
    const next: RunsAddress = { ...address, ...changes, page: 1 };
    const href = runsHrefOf(next);
    start(() => {
      router.replace(href);
    });
  }

  function chooseWorkflow(value: string) {
    const found = workflows.find(
      (each) => keyOf(each.namespace, each.name) === value,
    );
    apply({
      namespace: found?.namespace,
      name: found?.name,
      version: undefined,
    });
  }

  function chooseStatuses(values: string[]) {
    const joined = values.join(",");
    const statuses = statusesOf(joined);
    apply({ statuses });
  }

  function chooseStarted(value: string) {
    const started: Started = startedOf(value) ?? address.started;
    apply({ started, between: null });
  }

  function chooseVersion(value: string) {
    const version = value.trim();
    const kept = version === "" ? undefined : version;
    apply({ version: kept });
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
        <SelectTrigger aria-label="Workflow" className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any workflow</SelectItem>
          {workflows.map((each) => (
            <WorkflowOption
              key={keyOf(each.namespace, each.name)}
              workflow={each}
            />
          ))}
        </SelectContent>
      </Select>
      {address.name !== undefined && (
        <Input
          key={address.version ?? ""}
          aria-label="Version"
          placeholder="Version"
          defaultValue={address.version}
          onBlur={(event) => {
            chooseVersion(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") chooseVersion(event.currentTarget.value);
          }}
          className="w-28"
        />
      )}
      <ToggleGroup
        type="multiple"
        variant="outline"
        aria-label="Status"
        value={chosen}
        onValueChange={chooseStatuses}
      >
        {STATUSES.map((status) => (
          <StatusOption key={status} status={status} />
        ))}
      </ToggleGroup>
      <ToggleGroup
        type="single"
        variant="outline"
        aria-label="Started"
        value={startedChoice}
        onValueChange={chooseStarted}
      >
        {STARTED.map((each) => (
          <StartedOption key={each} started={each} />
        ))}
      </ToggleGroup>
      {address.between !== null && (
        <RangeChip
          range={address.between}
          zone={zone}
          onClear={() => {
            apply({ between: null });
          }}
        />
      )}
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

function WorkflowOption({ workflow }: { readonly workflow: KnownWorkflow }) {
  const key = keyOf(workflow.namespace, workflow.name);

  return (
    <SelectItem value={key}>
      {workflow.name}
      <span className="text-muted-foreground">{workflow.namespace}</span>
    </SelectItem>
  );
}

function StatusOption({ status }: { readonly status: RunStatus }) {
  const label = statusLabel(status, phaseLabel);

  return <ToggleGroupItem value={status}>{label}</ToggleGroupItem>;
}

function RangeChip({
  range,
  zone,
  onClear,
}: {
  readonly range: TimeWindow;
  readonly zone: string;
  readonly onClear: () => void;
}) {
  const phrase = windowPhrase(range, zone);
  const label = `Started ${phrase}`;
  const clearLabel = `Clear the range: ${label}`;

  return (
    <Button variant="outline" onClick={onClear} aria-label={clearLabel}>
      {label}
      <XIcon data-icon="inline-end" />
    </Button>
  );
}

function StartedOption({ started }: { readonly started: Started }) {
  const label = periodLabel(started);

  return <ToggleGroupItem value={started}>{label}</ToggleGroupItem>;
}

function keyOf(namespace: string | undefined, name: string | undefined) {
  if (namespace === undefined || name === undefined) return ANY;

  return `${namespace}/${name}`;
}
