import { CircleAlertIcon } from "lucide-react";
import { codeOf, type Problem } from "@/libs/data-access/problem";
import { Alert, AlertDescription, AlertTitle } from "../components/alert";

interface ProblemMessageProps {
  readonly problem: Problem | null;
}

export function ProblemMessage({ problem }: ProblemMessageProps) {
  if (problem === null) return null;

  const named = codeOf(problem) !== null && problem.title !== problem.detail;
  const located = problem.errors.filter(
    (error) => error.detail !== "" && error.detail !== problem.detail,
  );

  return (
    <Alert variant="destructive" aria-live="polite">
      <CircleAlertIcon />
      <AlertTitle>{named ? problem.title : problem.detail}</AlertTitle>
      {(named || located.length > 0) && (
        <AlertDescription>
          {named && <p>{problem.detail}</p>}
          {located.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {located.map((error) => (
                <li key={`${error.pointer}:${error.detail}`}>{error.detail}</li>
              ))}
            </ul>
          )}
        </AlertDescription>
      )}
    </Alert>
  );
}
