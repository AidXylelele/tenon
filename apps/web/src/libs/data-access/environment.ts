import "server-only";

export function apiUrl(): string {
  const url = process.env.API_URL;
  const unset = url === undefined || url === "";

  if (unset)
    throw new Error("API_URL is not set: the console cannot reach the API");

  return url;
}

export function isSessionCookieSecure(): boolean {
  return process.env.SESSION_COOKIE_SECURE !== "false";
}

export function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}
