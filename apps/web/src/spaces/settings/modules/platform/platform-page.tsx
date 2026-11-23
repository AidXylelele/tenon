import type { HostProfile } from "@/libs/data-access/types";
import { Disclosure } from "@/libs/ui/composites/disclosure";
import { PageHeader } from "@/libs/ui/composites/page-header";

interface Capability {
  readonly sentence: string;
  readonly terms: readonly string[];
}

const MEBIBYTE = 1_048_576;

export function PlatformPage({ profile }: { readonly profile: HostProfile }) {
  const shell = profile.shell;
  const limits = profile.limits;
  const mebibytes = (limits.responseBytes / MEBIBYTE).toFixed(1);
  const capabilities: readonly Capability[] = [
    { sentence: "Steps call services.", terms: profile.effects },
    {
      sentence: "Steps send and read messages.",
      terms: profile.asyncApiProtocols,
    },
    {
      sentence: "Steps use the tools of MCP servers.",
      terms: profile.mcpTransports,
    },
    {
      sentence: "Calls sign in to the services they call.",
      terms: profile.authentications,
    },
    { sentence: "Calls get OAuth2 tokens.", terms: profile.grants },
    { sentence: "Steps run code and commands.", terms: profile.processes },
    {
      sentence: "Scripts are written in these languages.",
      terms: profile.scriptLanguages,
    },
    { sentence: "Workflows start by themselves.", terms: profile.schedules },
  ];
  const offered = capabilities.filter(
    (capability) => capability.terms.length > 0,
  );
  const commandCount = `${String(shell.commands.length)} commands`;

  return (
    <div className="flex max-w-(--form-width-max) flex-col gap-6">
      <PageHeader
        level={2}
        title="Platform"
        description="What your steps can do on this Tenon."
      />
      <section aria-labelledby="what-steps-can-do" className="border-t pt-4">
        <h3 id="what-steps-can-do" className="mb-3 text-body font-semibold">
          What steps can do
        </h3>
        <ul className="flex flex-col gap-3">
          {offered.map((capability) => {
            const terms = capability.terms.join(" · ");
            return (
              <li key={capability.sentence}>
                {capability.sentence}
                <span className="block font-mono text-caption text-muted-foreground">
                  {terms}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <section aria-labelledby="limits" className="border-t pt-4">
        <h3 id="limits" className="mb-3 text-body font-semibold">
          Limits
        </h3>
        <p className="max-w-prose">
          A call has {limits.callSeconds} s to answer and a script or command{" "}
          {limits.processSeconds} s to finish; an answer is at most {mebibytes}{" "}
          MiB.
        </p>
      </section>
      <section aria-labelledby="shell" className="border-t pt-4">
        <h3 id="shell" className="mb-3 text-body font-semibold">
          Shell
        </h3>
        <p className="mb-3">
          Commands run in <span className="font-mono">{shell.shell}</span> on{" "}
          <span className="font-mono">{shell.platform}</span>.
        </p>
        <Disclosure title="Show the shell's commands" summary={commandCount}>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-caption">
            {shell.commands.map((command) => (
              <li key={command}>{command}</li>
            ))}
          </ul>
        </Disclosure>
      </section>
    </div>
  );
}
