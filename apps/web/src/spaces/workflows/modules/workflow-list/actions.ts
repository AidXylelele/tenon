"use server";

import { redirect } from "next/navigation";
import { writeDraft } from "@/libs/data-access/drafts";
import { editorHref } from "@/libs/routing/routes";
import { TEMPLATE_SOURCES } from "./template-sources";
import { TEMPLATES } from "./templates";

const EMPTY_LAYOUT = {};

export async function startFromTemplateAction(id: string): Promise<string> {
  const template = TEMPLATES.find((each) => each.id === id);
  const source = TEMPLATE_SOURCES[id];

  if (template === undefined || source === undefined)
    return "Tenon has no such template.";

  const content = { source, layout: EMPTY_LAYOUT };
  const written = await writeDraft(template.namespace, id, content, null);

  if (written.kind === "conflict")
    return `A workflow named ${id} already has a draft. Open it from the list, or start from scratch.`;

  if (written.kind === "refused") return written.problem.detail;

  const editor = editorHref(template.namespace, id);
  redirect(editor);
}
