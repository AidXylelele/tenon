export enum Role {
  Admin = "admin",
  Editor = "editor",
  Viewer = "viewer",
}

export enum UserStatus {
  Active = "active",
  Suspended = "suspended",
}

export enum InvitationStatus {
  Pending = "pending",
  Accepted = "accepted",
  Revoked = "revoked",
}

export enum UserRefusal {
  Suspended = "user.suspended",
}

export enum AccountRefusal {
  InvalidCredentials = "account.invalid-credentials",
  WrongPassword = "account.wrong-password",
}

export enum InvitationRefusal {
  Accepted = "invitation.accepted",
  Revoked = "invitation.revoked",
  Expired = "invitation.expired",
  EmailTaken = "invitation.email-taken",
}
