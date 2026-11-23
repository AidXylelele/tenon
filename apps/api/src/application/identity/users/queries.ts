import type { Member } from "./interfaces.js";

export abstract class MemberQueries {
  abstract list(): Promise<Member[]>;
}
