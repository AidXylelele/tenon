import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/libs/ui/components/card";

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
          <h1 className="heading-1">{title}</h1>
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
