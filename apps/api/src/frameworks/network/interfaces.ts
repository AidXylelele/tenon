import type ipaddr from "ipaddr.js";

export type IpAddress = ipaddr.IPv4 | ipaddr.IPv6;

export type AddressRange = [IpAddress, number];

export type AddressRanges = Parameters<typeof ipaddr.subnetMatch>[1];
