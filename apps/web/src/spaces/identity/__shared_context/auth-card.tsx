import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/libs/ui/components/card';

interface AuthCardProps {
  readonly title: string;
  readonly description?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly footer?: React.ReactNode;
}

export function AuthCard({
  title,
  description,
  children,
  footer,
}: AuthCardProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
          {description !== undefined && (
            <CardDescription>{description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
      {footer !== undefined && (
        <div className="text-center text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </>
  );
}
