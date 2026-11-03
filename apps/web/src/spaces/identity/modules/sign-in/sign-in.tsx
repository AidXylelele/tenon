import { InfoIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/libs/ui/components/alert';
import { AuthCard } from '../../__shared_context/auth-card';
import { returnPath } from '../../__shared_context/form-state';
import { SignInForm } from './sign-in-form';

const REASONS: Record<string, string> = {
  ended: 'Your session ended. Sign in to continue where you were.',
  'signed-out': 'You signed out.',
  'password-set': 'Your password is set. Sign in with it.',
};

interface SignInProps {
  readonly next?: string;
  readonly reason?: string;
}

export function SignIn({ next, reason }: SignInProps) {
  const notice = reason === undefined ? undefined : REASONS[reason];

  return (
    <AuthCard
      title="Sign in"
      description="Use the email and password of your account."
    >
      <div className="flex flex-col gap-4">
        {notice !== undefined && (
          <Alert>
            <InfoIcon />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        <SignInForm next={returnPath(next)} />
      </div>
    </AuthCard>
  );
}
