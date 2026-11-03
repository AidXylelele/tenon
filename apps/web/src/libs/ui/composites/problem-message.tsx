import { CircleAlertIcon } from 'lucide-react';
import type { Problem } from '@/libs/data-access/problem';
import { Alert, AlertDescription, AlertTitle } from '../components/alert';

interface ProblemMessageProps {
  readonly problem: Problem | null;
  readonly className?: string;
}

// The API's refusal as it gave it: its title, its detail, and each location it named.
export function ProblemMessage({ problem, className }: ProblemMessageProps) {
  if (problem === null) return null;

  const located = problem.errors.filter(
    (error) => error.detail !== problem.detail,
  );

  return (
    <Alert variant="destructive" className={className} aria-live="polite">
      <CircleAlertIcon />
      <AlertTitle>{problem.title}</AlertTitle>
      <AlertDescription>
        <p>{problem.detail}</p>
        {located.length > 0 && (
          <ul className="mt-1 list-disc pl-4">
            {located.map((error) => (
              <li key={`${error.pointer}:${error.detail}`}>
                <code className="font-mono text-xs">{error.pointer}</code>{' '}
                {error.detail}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
