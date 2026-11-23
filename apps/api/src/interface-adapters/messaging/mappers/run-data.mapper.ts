import { Injectable } from "@nestjs/common";
import type { JsonObject } from "../../../domain/automation/interfaces.js";
import { Cipher } from "../../persistence/interfaces.js";

@Injectable()
export class RunDataMapper {
  constructor(private readonly cipher: Cipher) {}

  sealedOf(data: JsonObject): string {
    const text = JSON.stringify(data);
    return this.cipher.seal(text);
  }

  dataOf(sealed: string): JsonObject {
    const text = this.cipher.open(sealed);
    return JSON.parse(text) as JsonObject;
  }
}
