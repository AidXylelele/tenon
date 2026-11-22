import { describe, expect, it } from "vitest";
import { fieldOf } from "./forms.test-support";
import {
  flowChoicesOf,
  flowText,
  hasWords,
  resultText,
  wordsOf,
} from "./words";

const ENDPOINT = fieldOf({
  key: "endpoint",
  title: "Endpoint",
  pointer: "/do/0/fetch/with/endpoint",
});

describe("the words a field is shown with", () => {
  it("a_known_field_of_a_kind_takes_the_design's_words_and_control", () => {
    const words = wordsOf("http", "with/endpoint", ENDPOINT);

    expect(words).toMatchObject({
      title: "Address",
      placeholder: "https://",
      control: "data",
      fill: "Enter the address to call, for example https://api.example.com/orders",
    });
  });

  it("a_field_shared_by_every_kind_takes_the_shared_words", () => {
    const words = wordsOf("wait", "if", ENDPOINT);

    expect(words.title).toBe("Run only if");
    expect(words.control).toBe("condition");
  });

  it("an_unknown_field_keeps_the_language_server's_title_as_a_plain_value", () => {
    const words = wordsOf("grpc", "with/endpoint", ENDPOINT);

    expect(words).toEqual({
      title: "Endpoint",
      help: null,
      placeholder: "",
      fill: null,
      control: "value",
      mono: false,
      choices: new Map(),
    });
  });

  it("a_kind's_own_words_are_known_and_another_kind's_are_not", () => {
    const own = hasWords("script", "run/script/environment");
    const other = hasWords("shell", "run/script/environment");

    expect([own, other]).toEqual([true, false]);
  });
});

describe("the words of where a step goes next", () => {
  it("directives_are_said_in_words_and_step_names_as_go_to", () => {
    const choices = flowChoicesOf(["continue", "exit", "end", "Totals", 3]);

    expect(choices).toEqual([
      { value: "continue", text: "Continue with the next step" },
      { value: "exit", text: "Leave the block" },
      { value: "end", text: "End the run" },
      { value: "Totals", text: "Go to “Totals”" },
    ]);
  });

  it("a_step_name_reads_as_going_to_it", () => {
    const text = flowText("Post the items");

    expect(text).toBe("Go to “Post the items”");
  });
});

describe("the words of a step's result", () => {
  it.each([
    ["printedJson", "The JSON it prints (usual)"],
    ["valuesOnly", "Only these values"],
  ] as const)("%s_reads_as_its_words", (result, expected) => {
    const text = resultText(result);

    expect(text).toBe(expected);
  });
});
