import type { StepList } from "language-server/protocol";
import { editorHref, versionSourceHref } from "@/libs/routing/routes";
import type { TestRun, WorkflowName } from "./interfaces";

export async function testRunOf(
  workflow: WorkflowName,
  id: string,
): Promise<TestRun> {
  const editor = editorHref(workflow.namespace, workflow.name);
  const href = `${editor}/test-runs/${encodeURIComponent(id)}`;
  const response = await answerOf(href);
  const test: TestRun = await response.json();
  return test;
}

export async function publishedStepsOf(
  workflow: WorkflowName,
  version: string,
): Promise<StepList> {
  const editor = editorHref(workflow.namespace, workflow.name);
  const href = `${editor}/versions/${encodeURIComponent(version)}/steps`;
  const response = await answerOf(href);
  const steps: StepList = await response.json();
  return steps;
}

export async function publishedTextOf(
  workflow: WorkflowName,
  version: string,
): Promise<string> {
  const href = versionSourceHref(workflow.namespace, workflow.name, version);
  const response = await answerOf(href);
  return response.text();
}

async function answerOf(href: string): Promise<Response> {
  const response = await fetch(href, { cache: "no-store", redirect: "manual" });

  if (!response.ok)
    throw new Error(`${href} answered ${String(response.status)}`);

  return response;
}
