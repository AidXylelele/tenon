import { ApiRoute } from "../../interface-adapters/api/enums.js";

export class RequestPath {
  private static readonly HEALTH = `/${ApiRoute.Prefix}/health`;
  private static readonly HOOKS = `/${ApiRoute.Prefix}/hooks/`;
  private static readonly HOOK = `${RequestPath.HOOKS}:token`;

  readonly #url: string;

  constructor(url: string | undefined) {
    this.#url = url ?? "";
  }

  isHealth(): boolean {
    return this.#url.startsWith(RequestPath.HEALTH);
  }

  isHook(): boolean {
    return this.#url.startsWith(RequestPath.HOOKS);
  }

  redacted(): string {
    const hook = this.isHook();

    if (hook) return RequestPath.HOOK;

    const query = this.#url.indexOf("?");

    if (query === -1) return this.#url;

    return this.#url.slice(0, query);
  }
}
