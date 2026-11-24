import { z } from "zod";
import { queryText } from "@/libs/routing/segment";

export const EditorQuery = z.object({ task: queryText });
