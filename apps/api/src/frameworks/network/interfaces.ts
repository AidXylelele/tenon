import type ipaddr from "ipaddr.js";

export type IpAddress = ipaddr.IPv4 | ipaddr.IPv6;

export type AddressRange = [IpAddress, number];

export type AddressRanges = Parameters<typeof ipaddr.subnetMatch>[1];

export interface BrokerServer {
  readonly url: string;
  readonly hostname: string;
  readonly port: number | null;
  readonly pathname: string;
  readonly secure: boolean;
}

export type Lost = () => void;

export interface Opening<C> {
  readonly server: BrokerServer;
  open(address: string, lost: Lost): Promise<C>;
}
