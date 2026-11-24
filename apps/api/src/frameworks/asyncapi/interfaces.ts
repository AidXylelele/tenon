import type { Parser } from "@asyncapi/parser";

export type ParserOptions = NonNullable<
  ConstructorParameters<typeof Parser>[0]
>;

export interface BrokerServer {
  readonly url: string;
  readonly hostname: string;
  readonly port: number | null;
  readonly pathname: string;
  readonly secure: boolean;
}

export interface Login {
  readonly username: string;
  readonly password: string;
}

export type Lost = () => void;

export interface Opening<C> {
  readonly server: BrokerServer;
  open(address: string, lost: Lost): Promise<C>;
}
