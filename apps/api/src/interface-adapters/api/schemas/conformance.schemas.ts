import { z } from 'zod';

const Names = z.array(z.string());

export const ConformanceResponse = z.object({
  dsl: Names,
  tasks: Names,
  calls: Names,
  runs: Names,
  scriptLanguages: Names,
  authentications: Names,
  excluded: Names,
  contradictions: Names,
});

export type ConformanceResponse = z.infer<typeof ConformanceResponse>;
