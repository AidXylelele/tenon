import { describe, expect, it } from "vitest";
import { choiceOfValue, choicesOf } from "./choices";
import {
  AFTER_FETCH,
  AT_AN_ADDRESS,
  dataOf,
  FETCH_ENTRY,
  FIRST_STEP,
  GREET_ENTRY,
  IN_A_LOOP,
  AFTER_A_TEST,
  typedAs,
} from "./data.test-support";

function titlesOf(groups: readonly { readonly title: string }[]) {
  return groups.map((group) => group.title);
}

function labelsOf(
  group:
    { readonly choices: readonly { readonly label: string }[] } | undefined,
) {
  return group?.choices.map((choice) => choice.label) ?? [];
}

describe("the data offered at a field", () => {
  it("is_grouped_by_the_steps_before_then_input_then_times", () => {
    const choices = choicesOf(AFTER_FETCH, "", false);

    const titles = titlesOf(choices.groups);

    expect(titles).toEqual([
      "From Fetch the digest",
      "From Greet",
      "Workflow input",
      "Dates and times",
    ]);
  });

  it("an_answer_not_seen_yet_says_to_run_a_test_or_type_a_field", () => {
    const choices = choicesOf(AFTER_FETCH, "", false);
    const [fetch] = choices.groups;

    const labels = labelsOf(fetch);
    expect(labels).toEqual(["Fetch the digest › the whole answer"]);
    expect(fetch?.note).toBe(
      "Run a test to see the fields of the answer, or type a field name.",
    );
  });

  it("fields_known_before_the_run_come_before_the_whole_answer", () => {
    const choices = choicesOf(AFTER_FETCH, "", false);
    const greet = choices.groups[1];

    expect(greet?.choices).toEqual([
      {
        id: "$context.Greet.message",
        label: "Greet › message",
        value: "${ $context.Greet.message }",
        expression: "$context.Greet.message",
        export: "/do/Greet",
        kind: "data",
        shape: "text",
        isPath: true,
      },
      expect.objectContaining({
        label: "Greet › the whole answer",
        shape: "fields",
      }),
    ]);
  });

  it("after_a_test_the_answer's_fields_are_the_ones_the_server_read_from_it", () => {
    const choices = choicesOf(AFTER_A_TEST, "", false);
    const [fetch] = choices.groups;

    expect(fetch?.title).toBe("From Fetch the digest");
    const labels = labelsOf(fetch);
    expect(labels).toEqual([
      "Fetch the digest › slideshow",
      "Fetch the digest › slideshow › title",
      "Fetch the digest › slideshow › slides",
      "Fetch the digest › the whole answer",
    ]);
    expect(fetch?.choices[2]).toMatchObject({
      expression: ".slideshow.slides",
      shape: "list of 2",
    });
    expect(fetch?.note).toBeNull();
  });

  it("with_no_step_before_it_says_the_first_step_gets_the_input", () => {
    const choices = choicesOf(FIRST_STEP, "", false);
    const [steps] = choices.groups;

    expect(steps).toEqual({
      id: "steps",
      title: "From earlier steps",
      choices: [],
      note: "No step runs before this one; the first step gets the workflow's input.",
    });
  });

  it("secrets_are_offered_where_the_language_server_offers_them", () => {
    const choices = choicesOf(AT_AN_ADDRESS, "", false);
    const secrets = choices.groups.at(-1);

    expect(secrets?.title).toBe("Secrets · kept out of run records");
    expect(secrets?.choices[0]).toMatchObject({
      label: "SLACK_WEBHOOK_URL",
      kind: "secret",
    });
  });

  it("a_loop's_item_is_a_variable", () => {
    const choices = choicesOf(IN_A_LOOP, "", false);
    const titles = titlesOf(choices.groups);

    expect(titles).toContain("Variables");
  });

  it("only_paths_leave_out_the_times", () => {
    const choices = choicesOf(AFTER_FETCH, "", true);
    const titles = titlesOf(choices.groups);

    expect(titles).not.toContain("Dates and times");
  });

  it("warnings_are_said_in_words_and_a_skipped_step_notes_its_group", () => {
    const data = dataOf(
      [GREET_ENTRY],
      [
        { kind: "mayHoldNothing", step: "/do/Greet" },
        { kind: "contextNotKnownObject" },
        { kind: "inputNotKnownObject", step: "/do/Totals" },
      ],
    );

    const choices = choicesOf(data, "", false);

    expect(choices.groups[0]?.note).toBe(
      "It holds nothing when “Greet” is skipped.",
    );
    expect(choices.notes).toHaveLength(2);
  });
});

describe("finding data by typing", () => {
  it("keeps_what_matches_and_drops_the_notes", () => {
    const data = typedAs(AFTER_FETCH, "MESSAGE", {
      "Fetch the digest": ".MESSAGE",
    });
    const choices = choicesOf(data, "MESSAGE", false);

    const titles = titlesOf(choices.groups);
    expect(titles).toEqual(["From Greet", "Use as a field of the answer"]);
    expect(choices.groups[0]?.note).toBeNull();
  });

  it("a_typed_field_name_is_offered_where_the_language_server_names_it", () => {
    const data = typedAs(AFTER_FETCH, "slideshow.title", {
      "Fetch the digest": ".slideshow.title",
    });
    const choices = choicesOf(data, "slideshow.title", false);
    const typed = choices.groups.at(-1);

    expect(typed).toEqual({
      id: "typed",
      title: "Use as a field of the answer",
      choices: [
        expect.objectContaining({
          label: "Fetch the digest › slideshow › title",
          expression: ".slideshow.title",
          export: null,
        }),
      ],
      note: "The test run shows whether the answer has it.",
    });
  });

  it("a_field_already_offered_is_not_offered_again", () => {
    const data = typedAs(AFTER_FETCH, "message", {
      "Fetch the digest": ".message",
      Greet: "$context.Greet.message",
    });
    const choices = choicesOf(data, "message", false);
    const typed = choices.groups.at(-1);

    const labels = labelsOf(typed);
    expect(labels).toEqual(["Fetch the digest › message"]);
  });

  it("an_answer_for_another_typed_name_is_not_offered", () => {
    const data = typedAs(AFTER_FETCH, "title", {
      "Fetch the digest": ".title",
    });
    const choices = choicesOf(data, "titles", false);
    const titles = titlesOf(choices.groups);

    expect(titles).not.toContain("Use as a field of the answer");
  });

  it("text_that_is_no_field_name_offers_nothing_typed", () => {
    const choices = choicesOf(AFTER_FETCH, "a b", false);

    expect(choices).toEqual({ groups: [], count: 0, notes: [] });
  });

  it("counts_what_it_shows", () => {
    const choices = choicesOf(AFTER_FETCH, "", false);

    expect(choices.count).toBe(6);
  });
});

describe("the data a value holds", () => {
  it("a_value_of_an_offered_choice_is_that_choice", () => {
    const choice = choiceOfValue("${ $context.Greet.message }", AFTER_FETCH);

    expect(choice?.label).toBe("Greet › message");
  });

  it.each([
    ["typed_text", "https://example.com"],
    ["a_number", 3],
  ])("%s_is_no_choice", (_, value) => {
    const choice = choiceOfValue(value, AFTER_FETCH);

    expect(choice).toBeNull();
  });

  it("the_whole_answer_of_the_step_before_reads_as_dot", () => {
    const choice = choiceOfValue("${ . }", AFTER_FETCH);

    expect(choice?.label).toBe(`${FETCH_ENTRY.name} › the whole answer`);
  });
});
