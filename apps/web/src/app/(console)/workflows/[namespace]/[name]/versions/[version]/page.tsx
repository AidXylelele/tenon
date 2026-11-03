import type { Metadata } from 'next';
import { VersionDocument } from '@/spaces/automation/modules/version-document';

export async function generateMetadata({
  params,
}: PageProps<'/workflows/[namespace]/[name]/versions/[version]'>): Promise<Metadata> {
  const { name, version } = await params;
  return {
    title: `${decodeURIComponent(name)} ${decodeURIComponent(version)}`,
  };
}

export default async function VersionPage({
  params,
}: PageProps<'/workflows/[namespace]/[name]/versions/[version]'>) {
  const { namespace, name, version } = await params;
  return (
    <VersionDocument
      namespace={decodeURIComponent(namespace)}
      name={decodeURIComponent(name)}
      version={decodeURIComponent(version)}
    />
  );
}
