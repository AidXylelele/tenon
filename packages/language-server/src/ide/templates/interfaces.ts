export interface TextPart {
  readonly kind: "text";
  readonly text: string;
}

export interface DataPart {
  readonly kind: "data";
  readonly expression: string;
  readonly label: string;
}

export type TemplatePart = TextPart | DataPart;

export type TemplateReading =
  | { readonly kind: "template"; readonly parts: readonly TemplatePart[] }
  | { readonly kind: "expression"; readonly text: string };

export type TemplateLookup =
  TemplateReading | { readonly kind: "refused"; readonly reason: string };

export type TemplateText =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "refused"; readonly reason: string };
