import { conformance } from '@/libs/data-access/automation';
import { Badge } from '@/libs/ui/components/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/libs/ui/components/card';
import { PageHeader } from '@/libs/ui/composites/page-header';

// The platform's statement of partial conformance to the Open Workflow DSL (002 ER-001): what
// it runs, what publishing refuses, and where the standard contradicts itself.
export async function Standard() {
  const statement = await conformance();

  return (
    <>
      <PageHeader
        level={2}
        title="Supported standard"
        description={`The Open Workflow DSL ${statement.dsl.join(', ')}. Publishing refuses anything outside what is listed here, so a run never fails for a construct the platform does not have.`}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Group title="Tasks" items={statement.tasks} />
        <Group title="Calls" items={statement.calls} />
        <Group title="Runs" items={statement.runs} />
        <Group title="Script languages" items={statement.scriptLanguages} />
        <Group title="Authentications" items={statement.authentications} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Refused at publish</CardTitle>
          <CardDescription>
            Parts of the standard the platform does not run yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {statement.excluded.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Where the standard contradicts itself</CardTitle>
          <CardDescription>And the reading the platform takes.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm">
            {statement.contradictions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}

function Group({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="font-mono">
            {item}
          </Badge>
        ))}
      </CardContent>
    </Card>
  );
}
