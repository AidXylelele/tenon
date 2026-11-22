export interface Preset {
  readonly label: string;
  readonly value: string;
}

export interface SubscriptionEditorProps {
  readonly secretNames: readonly string[];
  readonly presets: readonly Preset[];
}
