import { sourceDownload } from "@/spaces/workflows/modules/version-document";

export async function GET(
  _request: Request,
  {
    params,
  }: RouteContext<"/workflows/[namespace]/[name]/versions/[version]/source">,
): Promise<Response> {
  return sourceDownload(await params);
}
