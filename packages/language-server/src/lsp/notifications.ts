import type {
  Connection,
  NotificationType,
  RequestParam,
} from "vscode-languageserver/browser";

export function notify<Params>(
  connection: Connection,
  type: NotificationType<Params>,
  params: RequestParam<Params>,
): void {
  const sent = connection.sendNotification(type, params);

  sent.catch(() => undefined);
}
