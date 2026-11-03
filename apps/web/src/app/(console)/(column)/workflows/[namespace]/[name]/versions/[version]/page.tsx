import type { Metadata } from 'next';
import { segment } from '@/libs/routing/segment';
import { VersionDocument } from '@/spaces/automation/modules/version-document';

export async function generateMetadata({
  params,
}: PageProps<'/workflows/[namespace]/[name]/versions/[version]'>): Promise<Metadata> {
  const { name, version } = await params;
  return {
    title: `${segment(name)} ${segment(version)}`,
  };
}

export default async function VersionPage({
  params,
}: PageProps<'/workflows/[namespace]/[name]/versions/[version]'>) {
  const { namespace, name, version } = await params;
  return (
    <VersionDocument
      namespace={segment(namespace)}
      name={segment(name)}
      version={segment(version)}
    />
  );
}
