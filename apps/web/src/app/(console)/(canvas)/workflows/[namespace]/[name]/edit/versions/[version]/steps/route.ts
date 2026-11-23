import { publishedSteps } from "@/spaces/workflows/modules/workflow-editor";

export async function GET(
  _request: Request,
  {
    params,
  }: RouteContext<"/workflows/[namespace]/[name]/edit/versions/[version]/steps">,
): Promise<Response> {
  return publishedSteps(await params);
}
