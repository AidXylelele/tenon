import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/libs/ui/components/field';
import { Input } from '@/libs/ui/components/input';

// The length a new password must have, as the API checks it (001 FR-016).
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

interface NewPasswordFieldProps {
  // The field's id and the name the form sends it under.
  readonly name: string;
  readonly label: string;
  readonly autoFocus?: boolean;
  // What the page adds to the length the password must have.
  readonly note?: string;
}

// A password being chosen: reset, invitation, or change (001 FR-016). The browser checks its
// length as the API will, and offers to save it.
export function NewPasswordField({
  name,
  label,
  autoFocus = false,
  note,
}: NewPasswordFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        id={name}
        name={name}
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN}
        maxLength={PASSWORD_MAX}
        autoFocus={autoFocus}
      />
      <FieldDescription>
        At least {PASSWORD_MIN} characters.{note !== undefined && ` ${note}`}
      </FieldDescription>
    </Field>
  );
}
