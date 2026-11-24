interface TextPart {
  readonly kind: "text";
  readonly text: string;
}

interface VariablePart {
  readonly kind: "variable";
  readonly name: string;
}

export type UriTemplatePart = TextPart | VariablePart;

export interface UriTemplate {
  readonly source: string;
  readonly parts: readonly UriTemplatePart[];
}
