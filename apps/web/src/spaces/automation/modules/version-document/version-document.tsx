import { DownloadIcon, PencilIcon } from 'lucide-react';
import { Link } from '@/libs/routing/link';
import { notFound } from 'next/navigation';
import { versionDocument } from '@/libs/data-access/automation';
import { currentUser } from '@/libs/data-access/identity';
import { stringifyText } from '@/libs/document-text/document-text';
import { Button } from '@/libs/ui/components/button';
import { CopyButton } from '@/libs/ui/composites/copy-button';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { canAuthor } from '../../__shared_context/access';
import { workflowHref } from '../../__shared_context/links';

interface VersionDocumentProps {
  readonly namespace: string;
  readonly name: string;
  readonly version: string;
}

// A published version's document as YAML, exactly as published (002 FR-005).
export async function VersionDocument({
  namespace,
  name,
  version,
}: VersionDocumentProps) {
  const [user, document] = await Promise.all([
    currentUser(),
    versionDocument(namespace, name, version),
  ]);

  if (document === null) notFound();

  const yaml = stringifyText(document, 'yaml');
  const download = `data:application/yaml;charset=utf-8,${encodeURIComponent(yaml)}`;

  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Workflows', href: '/workflows' },
          { label: namespace },
          { label: name, href: workflowHref(namespace, name) },
          { label: `Version ${version}` },
        ]}
        title={`Version ${version}`}
        description="The document as it was published. A version never changes."
        actions={
          <>
            <CopyButton value={yaml} label="Copy YAML" size="sm" />
            <Button variant="outline" asChild>
              <a href={download} download={`${name}-${version}.yaml`}>
                <DownloadIcon data-icon="inline-start" />
                Download
              </a>
            </Button>
            {canAuthor(user) && (
              <Button variant="outline" asChild>
                <Link href={`${workflowHref(namespace, name)}/edit`}>
                  <PencilIcon data-icon="inline-start" />
                  Edit the current version
                </Link>
              </Button>
            )}
          </>
        }
      />
      <pre className="overflow-auto rounded-xl border bg-muted/30 p-4 font-mono text-xs leading-relaxed">
        {yaml}
      </pre>
    </>
  );
}
