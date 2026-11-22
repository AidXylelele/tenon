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

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

type Scale<Name extends string> = Readonly<Record<`${Name}${Step}`, string>>;

const STEPS: readonly Step[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function scaleEntriesOf<Name extends string>(
  name: Name,
  light: Scale<Name>,
  dark: Scale<Name>,
): [string, string][] {
  return STEPS.map((step) => {
    const key: `${Name}${Step}` = `${name}${step}`;
    const variable = `--${name}-${String(step)}`;
    return [variable, `light-dark(${light[key]}, ${dark[key]})`];
  });
}

const ENTRIES = [
  scaleEntriesOf("slate", slate, slateDark),
  scaleEntriesOf("iris", iris, irisDark),
  scaleEntriesOf("grass", grass, grassDark),
  scaleEntriesOf("amber", amber, amberDark),
  scaleEntriesOf("red", red, redDark),
  scaleEntriesOf("blue", blue, blueDark),
].flat();

export default plugin(({ addBase }) => {
  const variables = Object.fromEntries(ENTRIES);
  addBase({ ":root": variables });
});
