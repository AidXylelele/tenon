import { Injectable } from "@nestjs/common";
import type { Inbound } from "../../../domain/automation/instances/interfaces.js";
import { Cipher } from "../interfaces.js";

@Injectable()
export class InboundMapper {
  constructor(private readonly cipher: Cipher) {}

  sealedOf(inbound: Inbound): string {
    const text = JSON.stringify(inbound);
    return this.cipher.seal(text);
  }

  inboundOf(sealed: string): Inbound {
    const text = this.cipher.open(sealed);
    return JSON.parse(text) as Inbound;
  }
}
