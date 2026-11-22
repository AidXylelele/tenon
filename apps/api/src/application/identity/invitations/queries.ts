import type { ListedInvitation } from "./interfaces.js";

export abstract class InvitationQueries {
  abstract list(): Promise<ListedInvitation[]>;
}
