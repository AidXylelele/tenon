interface CronField {
  readonly minimum: number;
  readonly maximum: number;
  readonly names: readonly string[];
}

const months = "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");
const weekdays = "sun mon tue wed thu fri sat".split(" ");
const number = /^[0-9]+$/;

const fields: readonly CronField[] = [
  { minimum: 0, maximum: 59, names: [] },
  { minimum: 0, maximum: 23, names: [] },
  { minimum: 1, maximum: 31, names: [] },
  { minimum: 1, maximum: 12, names: months },
  { minimum: 0, maximum: 7, names: weekdays },
];

export function isCron(expression: string): boolean {
  const parts = expression.trim().split(/\s+/);
  const complete = parts.length === fields.length;

  return (
    complete &&
    fields.every((field, index) => {
      const part = parts[index] ?? "";
      return isField(part, field);
    })
  );
}

function isField(text: string, field: CronField): boolean {
  const items = text.split(",");
  return items.every((item) => isItem(item, field));
}

function isItem(text: string, field: CronField): boolean {
  const [range = "", ...steps] = text.split("/");
  const step = steps.join("/");
  const stepped = steps.length === 0 || isStep(step);

  if (range === "*") {
    return stepped;
  }

  const ordered = isOrderedRange(range, field);
  return ordered && stepped;
}

function isStep(text: string): boolean {
  const size = Number(text);
  return number.test(text) && size > 0;
}

function isOrderedRange(range: string, field: CronField): boolean {
  const [first = "", ...rest] = range.split("-");
  const last = rest.length === 0 ? first : rest.join("-");

  const low = numberOf(first, field);
  const high = numberOf(last, field);
  return low !== null && high !== null && low <= high;
}

function numberOf(text: string, field: CronField): number | null {
  const name = text.toLowerCase();
  const named = field.names.indexOf(name);

  if (named !== -1) {
    return named + field.minimum;
  }

  const value = Number(text);
  const numeric = number.test(text);
  const inRange = value >= field.minimum && value <= field.maximum;

  const isFieldValue = numeric && inRange;

  return isFieldValue ? value : null;
}
