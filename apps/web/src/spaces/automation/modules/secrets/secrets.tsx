import { KeyRoundIcon } from 'lucide-react';
import { secrets } from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/libs/ui/components/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/libs/ui/components/table';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { Time } from '@/libs/ui/composites/time';
import { canAuthor } from '../../__shared_context/access';
import { AuthorsOnly } from '../../__shared_context/authors-only';
import { DeleteButton } from '../../__shared_context/delete-button';
import { deleteSecretAction } from './actions';
import { SecretValueDialog } from './secret-value-dialog';

export async function Secrets() {
  const user = await currentUser();

  if (!canAuthor(user))
    return (
      <AuthorsOnly what="Secrets hold the credentials your workflows call services with." />
    );

  const list = await secrets();

  return (
    <>
      <PageHeader
        title="Credentials"
        description="Passwords, tokens and keys your workflows and notifications use, kept as secrets. Only runs read them; a value is never shown after it is saved."
        actions={<SecretValueDialog />}
      />
      {list.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <KeyRoundIcon />
            </EmptyMedia>
            <EmptyTitle>No secrets yet</EmptyTitle>
            <EmptyDescription>
              Add an API token or a login, then pick it in a step that calls a
              URL.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Changed</TableHead>
                <TableHead className="w-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((secret) => (
                <TableRow key={secret.name}>
                  <TableCell className="font-mono text-xs font-medium">
                    {secret.name}
                  </TableCell>
                  <TableCell>
                    <Time value={secret.createdAt} />
                  </TableCell>
                  <TableCell>
                    <Time value={secret.updatedAt} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <SecretValueDialog name={secret.name} />
                      <DeleteButton
                        what={secret.name}
                        consequence="Runs that need it fail with an authorization error until a secret of this name exists again."
                        onDelete={deleteSecretAction.bind(null, secret.name)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
