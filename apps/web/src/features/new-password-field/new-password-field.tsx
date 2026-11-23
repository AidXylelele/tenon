import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/libs/ui/components/field";
import { Input } from "@/libs/ui/components/input";

const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

interface NewPasswordFieldProps {
  readonly name: string;
  readonly label: string;
  readonly autoFocus?: boolean;
  readonly note?: string;
}

export function NewPasswordField({
  name,
  label,
  autoFocus = false,
  note,
}: NewPasswordFieldProps) {
  const hint = `${name}-hint`;

  return (
    <Field>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <FieldDescription id={hint}>
        At least {PASSWORD_MIN} characters.{note !== undefined && ` ${note}`}
      </FieldDescription>
      <Input
        id={name}
        aria-describedby={hint}
        name={name}
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        autoFocus={autoFocus}
      />
    </Field>
  );
}
