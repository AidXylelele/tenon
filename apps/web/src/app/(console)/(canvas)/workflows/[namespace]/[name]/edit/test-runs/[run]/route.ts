import { testRunProgress } from "@/spaces/workflows/modules/workflow-editor";

export async function GET(
  _request: Request,
  {
    params,
  }: RouteContext<"/workflows/[namespace]/[name]/edit/test-runs/[run]">,
): Promise<Response> {
  return testRunProgress(await params);
}
