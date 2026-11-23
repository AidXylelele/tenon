import { WidgetType } from "@codemirror/view";

const CHIP =
  "inline-flex items-center rounded-full border border-accent-border bg-accent-soft px-2 align-baseline text-caption text-accent-text";

export class ChipWidget extends WidgetType {
  constructor(private readonly words: string) {
    super();
  }

  override eq(other: ChipWidget): boolean {
    return other.words === this.words;
  }

  override toDOM(): HTMLElement {
    const chip = document.createElement("span");
    chip.className = CHIP;
    chip.textContent = this.words;
    return chip;
  }
}
