"use client";

import type { FormField } from "language-server/protocol";
import { createContext, useContext } from "react";
import type { WordsKind } from "../form-fields";
import type { Edit, FormSlots } from "./interfaces";

export interface FormSettings extends FormSlots {
  readonly kind: WordsKind;
  readonly base: string;
  readonly revealProblems: boolean;
  readonly languageTerms: boolean;
  readonly flowChoices: readonly FormField["value"][];
  readonly scriptLanguage: string;
  readonly onEdit: Edit;
}

export const FormSettingsContext = createContext<FormSettings | null>(null);

export function useFormSettings(): FormSettings {
  const settings = useContext(FormSettingsContext);

  if (settings === null)
    throw new Error("A field is rendered outside a step form.");

  return settings;
}

export function skippingEmpty(onEdit: Edit): Edit {
  return function send(actions) {
    if (actions.length > 0) onEdit(actions);
  };
}
