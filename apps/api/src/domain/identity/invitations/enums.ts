export enum InvitationStatus {
  Pending = "pending",
  Accepted = "accepted",
  Revoked = "revoked",
}

export enum InvitationRefusal {
  Accepted = "invitation.accepted",
  Revoked = "invitation.revoked",
  Expired = "invitation.expired",
  EmailTaken = "invitation.email-taken",
}
