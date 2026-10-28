export enum Role {
  Admin = 'admin',
  Editor = 'editor',
  Viewer = 'viewer',
}

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
}

export enum AccountType {
  Password = 'password',
  Oidc = 'oidc',
}

export enum InvitationStatus {
  Pending = 'pending',
  Accepted = 'accepted',
  Revoked = 'revoked',
}
