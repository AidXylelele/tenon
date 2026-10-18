import { randomBytes } from 'node:crypto';
import type { EncryptedSecret, WebhookEndpointProps } from './interfaces.js';

export class WebhookEndpoint {
  readonly #id: string;
  readonly #workflowId: string;
  readonly #nodeId: string;
  readonly #createdAt: Date;
  readonly #version: number;
  #secret: EncryptedSecret;
  #rotatedAt: Date | null;

  constructor(props: WebhookEndpointProps) {
    this.#id = props.id;
    this.#workflowId = props.workflowId;
    this.#nodeId = props.nodeId;
    this.#secret = props.secret;
    this.#createdAt = props.createdAt;
    this.#rotatedAt = props.rotatedAt;
    this.#version = props.version;
  }

  static open(
    workflowId: string,
    nodeId: string,
    secret: EncryptedSecret,
  ): WebhookEndpoint {
    const id = randomBytes(32).toString('base64url');
    const now = new Date();
    return new WebhookEndpoint({
      id,
      workflowId,
      nodeId,
      secret,
      createdAt: now,
      rotatedAt: null,
      version: 1,
    });
  }

  get id(): string {
    return this.#id;
  }

  get workflowId(): string {
    return this.#workflowId;
  }

  get nodeId(): string {
    return this.#nodeId;
  }

  get secret(): EncryptedSecret {
    return this.#secret;
  }

  get createdAt(): Date {
    return this.#createdAt;
  }

  get rotatedAt(): Date | null {
    return this.#rotatedAt;
  }

  get version(): number {
    return this.#version;
  }

  rotate(secret: EncryptedSecret): void {
    this.#secret = secret;
    this.#rotatedAt = new Date();
  }
}
