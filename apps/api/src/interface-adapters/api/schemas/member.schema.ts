import { z } from "zod";
import { MemberStatus } from "../../../application/identity/users/enums.js";
import { Role } from "../../../domain/identity/users/enums.js";
import { Email } from "./auth.schema.js";

const MemberResponse = z.object({
  id: z.uuid(),
  email: Email,
  name: z.string().nullable(),
  role: z.enum(Role),
  status: z.enum(MemberStatus),
  since: z.iso.datetime(),
});

export const MemberListResponse = z.array(MemberResponse);

export type MemberListResponse = z.infer<typeof MemberListResponse>;
