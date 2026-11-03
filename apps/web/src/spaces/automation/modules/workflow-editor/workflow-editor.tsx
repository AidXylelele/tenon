import { notFound } from 'next/navigation';
import {
  conformance,
  secrets,
  versionDocument,
  workflow,
} from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import type { JsonObject } from '@/libs/data-access/types';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/libs/ui/components/empty';
import { canAuthor } from '../../__shared_context/access';
import { draftFrom, newDraft } from '../../__shared_context/document/draft';
import { Editor } from './editor';

interface WorkflowEditorProps {
  // Present when editing an existing workflow; absent for a new one.
  readonly namespace?: string;
  readonly name?: string;
}

// Loads what the builder needs: the draft (a new document, or the current version with the
// next version proposed), the author's secrets and the platform's supported subset.
export async function WorkflowEditor({ namespace, name }: WorkflowEditorProps) {
  const user = await currentUser();

  if (!canAuthor(user))
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Viewers read workflows</EmptyTitle>
          <EmptyDescription>
            Ask an administrator for the editor role to build and publish.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  const [statement, owned, initial] = await Promise.all([
    conformance(),
    secrets(),
    initialDraft(namespace, name),
  ]);

  if (initial === null) notFound();

  const existing =
    namespace !== undefined && name !== undefined ? { namespace, name } : null;

  return (
    <Editor
      initial={initial}
      existing={existing}
      secretNames={owned.map((secret) => secret.name)}
      conformance={statement}
    />
  );
}

async function initialDraft(
  namespace: string | undefined,
  name: string | undefined,
): Promise<JsonObject | null> {
  if (namespace === undefined || name === undefined) return newDraft();

  const found = await workflow(namespace, name);

  if (found === null || found.currentVersion === null) return null;

  const document = await versionDocument(namespace, name, found.currentVersion);
  return document === null ? null : draftFrom(document);
}
