import { currentUser } from '@/libs/data-access/identity';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/libs/ui/components/card';
import { PageHeader } from '@/libs/ui/composites/page-header';
import { PasswordForm } from './password-form';

const ROLE: Record<string, string> = {
  admin: 'Administrator: everything editors do, and inviting people',
  editor: 'Editor: builds, runs and connects automations',
  viewer: 'Viewer: reads workflows and runs',
};

export async function Account() {
  const user = await currentUser();

  if (user === null) return null;

  return (
    <>
      <PageHeader
        title="Account"
        description="Who you are signed in as, and your password."
      />
      <Card>
        <CardHeader>
          <CardTitle>{user.name}</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {ROLE[user.role]}
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
