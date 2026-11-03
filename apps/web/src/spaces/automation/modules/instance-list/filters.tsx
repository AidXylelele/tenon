'use client';

import { XIcon } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import type { InstanceFilter, Phase } from '@/libs/data-access/types';
import { Button } from '@/libs/ui/components/button';
import { Input } from '@/libs/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/libs/ui/components/select';
import { Spinner } from '@/libs/ui/components/spinner';
import { PHASES, phaseLabel } from '../../__shared_context/vocabulary';

const ANY = 'any';

const PERIODS = [
  { value: ANY, label: 'Any time' },
  { value: '1h', label: 'Last hour', ms: 3_600_000 },
  { value: '24h', label: 'Last 24 hours', ms: 86_400_000 },
  { value: '7d', label: 'Last 7 days', ms: 604_800_000 },
] as const;

// The filters of the runs list, kept in the address; changing one shows its result as soon as
// it arrives, with the list marked as updating meanwhile.
export function Filters({ filter }: { readonly filter: InstanceFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();

  function apply(
    changes: Partial<Record<keyof InstanceFilter, string | undefined>>,
  ) {
    const query = new URLSearchParams();
    const next = { ...filter, ...changes, cursor: undefined };

    for (const [key, value] of Object.entries(next))
      if (value !== undefined && value !== '' && value !== ANY)
        query.set(key, String(value));

    start(() => router.replace(`${pathname}?${query.toString()}`));
  }

  const any = [
    filter.namespace,
    filter.name,
    filter.version,
    filter.phase,
    filter.startedFrom,
  ].some((value) => value !== undefined);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Namespace"
        placeholder="Namespace"
        defaultValue={filter.namespace}
        onBlur={(event) => apply({ namespace: event.target.value.trim() })}
        onKeyDown={(event) =>
          event.key === 'Enter' &&
          apply({ namespace: event.currentTarget.value.trim() })
        }
        className="w-32"
      />
      <Input
        aria-label="Workflow"
        placeholder="Workflow"
        defaultValue={filter.name}
        onBlur={(event) => apply({ name: event.target.value.trim() })}
        onKeyDown={(event) =>
          event.key === 'Enter' &&
          apply({ name: event.currentTarget.value.trim() })
        }
        className="w-40"
      />
      <Input
        aria-label="Version"
        placeholder="Version"
        defaultValue={filter.version}
        onBlur={(event) => apply({ version: event.target.value.trim() })}
        onKeyDown={(event) =>
          event.key === 'Enter' &&
          apply({ version: event.currentTarget.value.trim() })
        }
        className="w-24"
      />
      <Select
        value={filter.phase ?? ANY}
        onValueChange={(phase) => apply({ phase })}
      >
        <SelectTrigger aria-label="Phase" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any phase</SelectItem>
          {PHASES.map((phase: Phase) => (
            <SelectItem key={phase} value={phase}>
              {phaseLabel(phase)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={periodOf(filter.startedFrom)}
        onValueChange={(period) => {
          const span = PERIODS.find((each) => each.value === period);
          const from =
            span !== undefined && 'ms' in span
              ? new Date(Date.now() - span.ms).toISOString()
              : undefined;
          apply({ startedFrom: from });
        }}
      >
        <SelectTrigger aria-label="Started" className="w-36">
          <SelectValue placeholder="Any time" />
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map((period) => (
            <SelectItem key={period.value} value={period.value}>
              {period.label}
            </SelectItem>
          ))}
          {periodOf(filter.startedFrom) === 'custom' && (
            <SelectItem value="custom">Since a chosen time</SelectItem>
          )}
        </SelectContent>
      </Select>
      {any && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => start(() => router.replace(pathname))}
        >
          <XIcon data-icon="inline-start" />
          Clear
        </Button>
      )}
      {pending && (
        <Spinner className="text-muted-foreground" aria-label="Updating" />
      )}
    </div>
  );
}

function periodOf(startedFrom: string | undefined): string {
  if (startedFrom === undefined) return ANY;

  return 'custom';
}
