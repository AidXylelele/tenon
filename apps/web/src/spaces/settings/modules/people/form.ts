import { z } from "zod";

export const InviteFields = z.object({
  email: z.string().trim(),
  role: z.enum(["admin", "editor", "viewer"], "Choose a role"),
});
