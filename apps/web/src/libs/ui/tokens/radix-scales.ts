import {
  amber,
  amberDark,
  blue,
  blueDark,
  grass,
  grassDark,
  iris,
  irisDark,
  red,
  redDark,
  slate,
  slateDark,
} from "@radix-ui/colors";
import plugin from "tailwindcss/plugin";

type Scale = Readonly<Record<string, string>>;

interface ScalePair {
  readonly name: string;
  readonly light: Scale;
  readonly dark: Scale;
}

const SCALES: readonly ScalePair[] = [
  { name: "slate", light: slate, dark: slateDark },
  { name: "iris", light: iris, dark: irisDark },
  { name: "grass", light: grass, dark: grassDark },
  { name: "amber", light: amber, dark: amberDark },
  { name: "red", light: red, dark: redDark },
  { name: "blue", light: blue, dark: blueDark },
];

export function scaleEntriesOf(
  name: string,
  light: Scale,
  dark: Scale,
): [string, string][] {
  return Object.entries(light).map(([key, day]) => {
    const step = key.slice(name.length);
    const night = dark[key];

    if (night === undefined)
      throw new Error(`The dark ${name} scale has no step ${step}.`);

    return [`--${name}-${step}`, `light-dark(${day}, ${night})`];
  });
}

export default plugin(({ addBase }) => {
  const entries = SCALES.flatMap(({ name, light, dark }) =>
    scaleEntriesOf(name, light, dark),
  );
  const variables = Object.fromEntries(entries);
  addBase({ ":root": variables });
});
