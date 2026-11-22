import { KeyRoundIcon, Trash2Icon } from "lucide-react";
import { secrets } from "@/libs/data-access/automation";
import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
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
import { ConfirmAction } from "@/libs/ui/composites/confirm-action";
import { EmptyState } from "@/libs/ui/composites/empty-state";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { TableFrame } from "@/libs/ui/composites/table-frame";
import { Time } from "@/libs/ui/composites/time";
import { ViewerNotice } from "@/features/viewer-notice";
import { deleteSecretAction } from "./actions";
import { SecretValueDialog } from "./secret-value-dialog";
import { Unavailable } from "@/libs/ui/composites/unavailable";

export async function Secrets() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  if (session?.capabilities.author !== true)
    return (
      <>
        <PageHeader title="Secrets" />
        <ViewerNotice what="Secrets hold the passwords, tokens and keys your tasks call services with." />
      </>
    );

  const list = await available(secrets());

  if (list === UNAVAILABLE) return <Unavailable />;

  return (
    <>
      <PageHeader
        title="Secrets"
        description="Passwords, tokens and keys your tasks and notifications use. A value is never shown after it is saved."
        actions={<SecretValueDialog />}
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<KeyRoundIcon />}
          title="No secrets yet"
          description="Add an API token or a login, then pick it in a task that calls a service."
        />
      ) : (
        <TableFrame>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Used by</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead>Changed</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((secret) => (
                <SecretRow key={secret.name} secret={secret} />
              ))}
            </TableBody>
          </Table>
        </TableFrame>
      )}
    </>
  );
}

function SecretRow({ secret }: { readonly secret: Secret }) {
  const usedBy = secret.usedBy;
  const label = `Delete ${secret.name}`;
  const users = usedBy.map((each) => each.name).join(", ");
  const warning =
    usedBy.length === 0
      ? "No current version uses it."
      : `${users} use it; their runs fail until a secret of this name exists again.`;
  const title = `${label}?`;
  const remove = deleteSecretAction.bind(null, secret.name);
  const removed = `${secret.name} deleted`;

  return (
    <TableRow>
      <TableCell className="font-mono text-code font-medium">
        {secret.name}
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {usedBy.length === 0 ? (
          <span className="text-muted-foreground">Nothing yet</span>
        ) : (
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {usedBy.map((each) => (
              <Link
                key={`${each.namespace}/${each.name}`}
                href={versionHref(each.namespace, each.name, each.version)}
                className="hover:underline"
              >
                {each.name} {each.version}
              </Link>
            ))}
          </span>
        )}
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Time value={secret.createdAt} />
      </TableCell>
      <TableCell>
        <Time value={secret.updatedAt} />
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <SecretValueDialog name={secret.name} />
          <ConfirmAction
            icon={<Trash2Icon />}
            label={label}
            size="icon-sm"
            title={title}
            description={warning}
            actionLabel="Delete secret"
            action={remove}
            success={removed}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
