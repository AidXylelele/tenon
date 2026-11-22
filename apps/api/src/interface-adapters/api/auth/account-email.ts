export function accountEmail(request: {
  readonly body?: { readonly email?: unknown };
}): string {
  const email = request.body?.email;

  if (typeof email !== "string") return "";

  return email.trim().normalize("NFC").toLowerCase();
}
