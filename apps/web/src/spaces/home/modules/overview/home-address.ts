import { z } from "zod";
import { PERIODS, type Period } from "@/operations/run-periods";

const Read = z.object({
  period: z.enum(PERIODS).catch("24h"),
});

export function periodOf(query: unknown): Period {
  const read = Read.parse(query);
  return read.period;
}
