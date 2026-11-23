import { KeyRoundIcon } from "lucide-react";
import type { Secret } from "@/libs/data-access/types";
import { Link } from "@/libs/routing/link";
import { versionHref } from "@/libs/routing/routes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/libs/ui/components/table";
import { EmptyState } from "@/libs/ui/composites/empty-state";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { TableFrame } from "@/libs/ui/composites/table-frame";
import { Time } from "@/libs/ui/composites/time";
import { NewSecret } from "./new-secret";
import { SecretMenu } from "./secret-menu";

export interface SecretsPageProps {
  readonly secrets: readonly Secret[];
  readonly creating: boolean;
}

const PURPOSE =
  "Passwords, tokens and keys your steps and notifications use. A value is never shown again after it is saved.";

export function SecretsPage({ secrets, creating }: SecretsPageProps) {
  const none = secrets.length === 0;
  const create = <NewSecret defaultOpen={creating} />;

  return (
    <>
      <PageHeader
        title="Secrets"
        description={PURPOSE}
        actions={none ? undefined : create}
      />
      {none ? (
        <EmptyState
          icon={<KeyRoundIcon />}
          title="No secrets yet"
          description="Save an API token or a login, then pick it in a step that calls a service."
          action={create}
        />
      ) : (
        <TableFrame>
          <div role="region" aria-label="Secrets" tabIndex={0}>
            <Table className="min-w-[36rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Used by</TableHead>
                  <TableHead>Changed</TableHead>
                  <TableHead className="w-0">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {secrets.map((secret) => (
                  <SecretRow key={secret.name} secret={secret} />
                ))}
              </TableBody>
            </Table>
          </div>
        </TableFrame>
      )}
    </>
  );
}

function SecretRow({ secret }: { readonly secret: Secret }) {
  const usedBy = secret.usedBy;
  const users = usedBy.map((each) => each.name).join(", ");
  const warning =
    usedBy.length === 0
      ? "No step uses this secret."
      : `${users} use it; their runs fail until a secret of this name exists again.`;

  return (
    <TableRow>
      <TableCell className="font-mono font-semibold">{secret.name}</TableCell>
      <TableCell>
        {usedBy.length === 0 ? (
          <span className="text-muted-foreground">Not used yet</span>
        ) : (
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {usedBy.map((each) => {
              const href = versionHref(each.namespace, each.name, each.version);
              return (
                <Link
                  key={`${each.namespace}/${each.name}/${each.version}`}
                  href={href}
                  className="text-accent-text underline-offset-4 hover:underline"
                >
                  {each.name} {each.version}
                </Link>
              );
            })}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Time value={secret.updatedAt} />
      </TableCell>
      <TableCell>
        <SecretMenu name={secret.name} warning={warning} />
      </TableCell>
    </TableRow>
  );
}
