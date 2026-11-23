import {
  BracesIcon,
  CalendarClockIcon,
  GlobeIcon,
  HandIcon,
  type LucideIcon,
  RepeatIcon,
  SendIcon,
  ShieldIcon,
  SplitIcon,
  WebhookIcon,
} from "lucide-react";

export interface TemplateStep {
  readonly icon: LucideIcon;
  readonly words: string;
}

export interface Template {
  readonly id: string;
  readonly namespace: string;
  readonly title: string;
  readonly description: string;
  readonly steps: readonly TemplateStep[];
}

export const TEMPLATES: readonly Template[] = [
  {
    id: "daily-digest",
    namespace: "default",
    title: "Every day, fetch a URL and post the result",
    description: "A schedule, a call, a condition and a post.",
    steps: [
      { icon: CalendarClockIcon, words: "Every day at 09:00" },
      { icon: GlobeIcon, words: "Fetch a URL" },
      { icon: SplitIcon, words: "If it has items" },
      { icon: SendIcon, words: "Post them to a URL" },
    ],
  },
  {
    id: "forward-webhook",
    namespace: "default",
    title: "When a webhook is called, forward the data",
    description: "Another app calls Tenon; Tenon sends the data on.",
    steps: [
      { icon: WebhookIcon, words: "When the webhook is called" },
      { icon: GlobeIcon, words: "Send the data to a URL" },
    ],
  },
  {
    id: "route-by-condition",
    namespace: "default",
    title: "Route by a condition",
    description: "Go one way or another, then set the result.",
    steps: [
      { icon: HandIcon, words: "By hand" },
      { icon: SplitIcon, words: "Choose a path" },
      { icon: BracesIcon, words: "Set the result" },
    ],
  },
  {
    id: "repeat-for-each",
    namespace: "default",
    title: "Repeat for each item of a list",
    description: "Fetch a list and send every item.",
    steps: [
      { icon: HandIcon, words: "By hand" },
      { icon: GlobeIcon, words: "Fetch the list" },
      { icon: RepeatIcon, words: "For each item" },
      { icon: SendIcon, words: "Send the item" },
    ],
  },
  {
    id: "retry-a-call",
    namespace: "default",
    title: "Retry a call that fails",
    description: "Try a call three times before giving up.",
    steps: [
      { icon: HandIcon, words: "By hand" },
      { icon: ShieldIcon, words: "Try, retry 3 times" },
      { icon: GlobeIcon, words: "Call the service" },
    ],
  },
];
