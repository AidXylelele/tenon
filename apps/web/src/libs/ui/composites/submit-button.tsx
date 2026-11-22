"use client";

import { useFormStatus } from "react-dom";
import { Button } from "../components/button";
import { Spinner } from "../components/spinner";

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  readonly pendingLabel?: React.ReactNode;
};

export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending && <Spinner data-icon="inline-start" />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
