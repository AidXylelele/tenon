import { z } from "zod";

export const InvitationQuery = z.object({ token: z.string().min(1).catch("") });
