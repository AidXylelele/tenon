import { z } from "zod";

const ImportUri = z.url({ protocol: /^https?$/ }).max(2_048);

export const FetchImportBody = z.strictObject({ uri: ImportUri });

export type FetchImportBody = z.infer<typeof FetchImportBody>;

export const ImportTextResponse = z.object({ text: z.string() });

export type ImportTextResponse = z.infer<typeof ImportTextResponse>;
