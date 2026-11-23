import { type SQL, sql } from "drizzle-orm";
import { workflowVersion } from "../schema/index.js";

export function versionTitle(): SQL<string | null> {
  return sql<
    string | null
  >`${workflowVersion.document} -> 'document' ->> 'title'`;
}
