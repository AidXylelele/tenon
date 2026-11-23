import type { HostProfile } from "@/libs/data-access/types";
import { Badge } from "@/libs/ui/components/badge";
import { Disclosure } from "@/libs/ui/composites/disclosure";
import { PageHeader } from "@/libs/ui/composites/page-header";

interface Capability {
  readonly label: string;
  readonly values: readonly string[];
}

const MEBIBYTE = 1_048_576;

export function PlatformPage({ profile }: { readonly profile: HostProfile }) {
  const shell = profile.shell;
  const limits = profile.limits;
  const mebibytes = (limits.responseBytes / MEBIBYTE).toFixed(1);
  const capabilities: readonly Capability[] = [
    { label: "Steps call services over", values: profile.effects },
    { label: "Messages go over", values: profile.asyncApiProtocols },
    { label: "MCP servers are reached by", values: profile.mcpTransports },
    { label: "Calls sign in with", values: profile.authentications },
    { label: "OAuth2 grants", values: profile.grants },
    { label: "Steps run", values: profile.processes },
    { label: "Scripts are written in", values: profile.scriptLanguages },
    { label: "Workflows start by themselves", values: profile.schedules },
  ];
  const commandCount = `${String(shell.commands.length)} commands`;

  return (
    <div className="flex max-w-(--form-width-max) flex-col gap-6">
      <PageHeader
        level={2}
        title="Platform"
        description="What your steps can do on this Tenon."
      />
      <section aria-labelledby="what-steps-can-do" className="border-t pt-4">
        <h2 id="what-steps-can-do" className="mb-3 text-body font-semibold">
          What steps can do
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
          {capabilities.map((capability) => (
            <div key={capability.label} className="contents">
              <dt className="text-muted-foreground">{capability.label}</dt>
              <dd className="flex flex-wrap gap-1">
                {capability.values.length === 0 ? (
                  <span className="text-muted-foreground">Nothing here</span>
                ) : (
                  capability.values.map((value) => (
                    <Badge key={value} variant="secondary">
                      {value}
                    </Badge>
                  ))
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-labelledby="limits" className="border-t pt-4">
        <h2 id="limits" className="mb-3 text-body font-semibold">
          Limits
        </h2>
        <p className="max-w-prose">
          A call has {limits.callSeconds} s to answer and a script or command{" "}
          {limits.processSeconds} s to finish; an answer is at most {mebibytes}{" "}
          MiB.
        </p>
      </section>
      <section aria-labelledby="shell" className="border-t pt-4">
        <h2 id="shell" className="mb-3 text-body font-semibold">
          Shell
        </h2>
        <p className="mb-3">
          Commands run in {shell.shell} on {shell.platform}.
        </p>
        <Disclosure title="Show the shell's commands" summary={commandCount}>
          {shell.commands.length === 0 ? (
            <p className="text-muted-foreground">None</p>
          ) : (
            <ul className="flex flex-wrap gap-1">
              {shell.commands.map((command) => (
                <li key={command}>
                  <Badge variant="outline" className="font-mono">
                    {command}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Disclosure>
      </section>
    </div>
  );
}
