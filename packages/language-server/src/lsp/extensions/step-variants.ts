import { RequestType0 } from "vscode-languageserver/browser";
import { supportedVariantsOf } from "../../ide/variants/index.js";
import { methods, type StepVariantsResult } from "../../protocol/index.js";
import type { AnalysisHost } from "../analysis-host.js";

export const stepVariantsRequest = new RequestType0<StepVariantsResult, void>(
  methods.stepVariants,
);

export function stepVariantsHandlerOf(
  host: AnalysisHost,
): () => StepVariantsResult {
  return () => {
    const analyze = (text: string) => host.analyzeAlone(text);
    const variants = supportedVariantsOf(analyze);

    return { variants };
  };
}
