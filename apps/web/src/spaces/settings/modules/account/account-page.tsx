import type { User } from "@/libs/data-access/types";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { roleDuties, roleLabel } from "@/operations/roles";
import { PasswordForm } from "./password-form";

export function AccountPage({ user }: { readonly user: User }) {
  const role = roleLabel(user.role);
  const duties = roleDuties(user.role);

  return (
    <div className="flex max-w-(--form-width-max) flex-col gap-6">
      <PageHeader
        level={2}
        title="Account"
        description="Who you are signed in as, and your password."
      />
      <section aria-labelledby="your-account" className="border-t pt-4">
        <h3 id="your-account" className="mb-3 text-body font-semibold">
          Your account
        </h3>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="break-all">{user.email}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>
            {role}: {duties}
          </dd>
        </dl>
      </section>
      <section aria-labelledby="password" className="border-t pt-4">
        <h3 id="password" className="mb-3 text-body font-semibold">
          Password
        </h3>
        <PasswordForm />
      </section>
    </div>
  );
}
