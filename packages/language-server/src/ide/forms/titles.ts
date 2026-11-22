const memberTitles: ReadonlyMap<string, string> = new Map([
  ["if", "Run only if"],
  ["then", "Then go to"],
  ["timeout", "Time limit"],
  ["metadata", "Notes"],
  ["call", "Kind of call"],
  ["with", "Arguments"],
  ["catch", "When it fails"],
  ["schedule", "How it starts"],
  ["cron", "On a cron schedule"],
  ["after", "Again after each run"],
  ["on", "On events"],
  ["read", "Read events as"],
]);

const wordStart = /([a-z0-9])([A-Z])/g;

export function titleOf(key: string): string {
  return memberTitles.get(key) ?? spokenOf(key);
}

function spokenOf(key: string): string {
  const words = key.replace(wordStart, "$1 $2").toLowerCase();
  const first = words.charAt(0).toUpperCase();

  return first + words.slice(1);
}
