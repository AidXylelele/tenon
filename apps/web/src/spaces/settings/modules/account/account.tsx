import { available, UNAVAILABLE } from "@/libs/data-access/http";
import { currentSession } from "@/libs/data-access/identity";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/libs/ui/components/card";
import { PageHeader } from "@/libs/ui/composites/page-header";
import { Unavailable } from "@/libs/ui/composites/unavailable";
import { roleDuties, roleLabel } from "@/operations/roles";
import { PasswordForm } from "./password-form";

export async function Account() {
  const session = await available(currentSession());

  if (session === UNAVAILABLE) return <Unavailable />;

  const user = session?.user ?? null;

  if (user === null) return null;

  return (
    <>
      <PageHeader
        level={2}
        title="Account"
        description="Who you are signed in as, and your password."
      />
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {roleLabel(user.role)}: {roleDuties(user.role)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </>
  );
}
