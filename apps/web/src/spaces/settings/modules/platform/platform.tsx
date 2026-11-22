import { hostProfile } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { Badge } from "@/libs/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/libs/ui/components/card";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { Unavailable } from "@/libs/ui/composites/unavailable";

export async function Platform() {
  const profile = await available(hostProfile());

  if (profile === UNAVAILABLE) return <Unavailable />;

  const shell = profile.shell;
  const limits = profile.limits;
  const rows = [
    { label: "Calls", values: profile.effects },
    { label: "AsyncAPI protocols", values: profile.asyncApiProtocols },
    { label: "MCP transports", values: profile.mcpTransports },
    { label: "Authentication", values: profile.authentications },
    { label: "OAuth2 grants", values: profile.grants },
    { label: "Processes", values: profile.processes },
    { label: "Script languages", values: profile.scriptLanguages },
    { label: "Starts by itself", values: profile.schedules },
  ];
  const mebibytes = (limits.responseBytes / 1_048_576).toFixed(1);

  return (
    <>
      <PageHeader
        level={2}
        title="Platform"
        description="What workflows on this platform can call and run."
      />
      <Card>
        <CardHeader>
          <CardTitle>Capabilities</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-[12rem_1fr]">
            {rows.map((row) => (
              <div key={row.label} className="contents">
                <dt className="font-medium">{row.label}</dt>
                <dd className="flex flex-wrap gap-1">
                  {row.values.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    row.values.map((value) => (
                      <Badge key={value} variant="secondary">
                        {value}
                      </Badge>
                    ))
                  )}
                </dd>
              </div>
            ))}
            <dt className="font-medium">Limits</dt>
            <dd className="text-muted-foreground">
              A call answers within {limits.callSeconds} s, a process within{" "}
              {limits.processSeconds} s; a response is at most {mebibytes} MiB.
            </dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Shell</CardTitle>
          <CardDescription>
            {shell.shell} on {shell.platform}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1 text-sm">
          {shell.commands.length === 0 ? (
            <span className="text-muted-foreground">None</span>
          ) : (
            shell.commands.map((command) => (
              <Badge key={command} variant="outline" className="font-mono">
                {command}
              </Badge>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
