import type { SentMail } from "@nestjs/mail";
import type { TestApp } from "./create-test-app.js";

export async function invitationTokenFor(
  t: TestApp,
  email: string,
): Promise<string> {
  const mail = await t.untilMailDeliveredTo(email);

  return tokenIn(mail, email, "/invitations/accept");
}

export async function recoveryTokenFor(
  t: TestApp,
  email: string,
): Promise<string> {
  const mail = await t.untilMailDeliveredTo(email);

  return tokenIn(mail, email, "/reset-password");
}

const tokenIn = (mail: SentMail, email: string, path: string): string => {
  const link = mail.link(path);
  const token = link.searchParams.get("token");

  if (!token)
    throw new Error(
      `The mail to ${email} holds no link to ${path} with a token`,
    );

  return token;
};
