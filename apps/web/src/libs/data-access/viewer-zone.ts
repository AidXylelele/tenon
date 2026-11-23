export const ZONE_COOKIE = "console_zone";

export const UTC = "UTC";

export function zoneOf(text: string | undefined): string {
  if (text === undefined || text === "") return UTC;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: text });
    return text;
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;

    return UTC;
  }
}
