import type { Phase } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { PHASES } from "@/operations/run-progress";
import type { PhaseCountsProps } from "./interfaces";
import { PhaseStatus } from "./run-status";

export function PhaseCounts({ id, title, counts, hrefOf }: PhaseCountsProps) {
  const present = PHASES.filter((phase: Phase) => counts[phase] > 0);

  return (
    <section
      aria-labelledby={id}
      className="flex flex-wrap items-baseline gap-x-6 gap-y-2"
    >
      <h2 id={id} className="text-sm font-medium text-muted-foreground">
        {title}
      </h2>
      {present.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs started.</p>
      ) : (
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {present.map((phase) => (
            <li key={phase}>
              <Link
                href={hrefOf(phase)}
                className="flex items-baseline gap-2 rounded-md hover:underline"
              >
                <PhaseStatus phase={phase} />
                <span className="figure">{counts[phase]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
