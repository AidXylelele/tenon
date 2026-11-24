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
    <Button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      {...props}
    >
      {pending && (
        <span
          data-icon="inline-start"
          className="inline-flex animate-in fill-mode-backwards fade-in delay-1000"
        >
          <Spinner />
        </span>
      )}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
