import { WebhookEndpoint } from '../../../domain/webhook-endpoint.js';
import type { WebhookEndpointRow } from '../../interfaces.js';

export class WebhookEndpointMapper {
  static toRow(endpoint: WebhookEndpoint): WebhookEndpointRow {
    return {
      id: endpoint.id,
      workflowId: endpoint.workflowId,
      nodeId: endpoint.nodeId,
      secretCiphertext: endpoint.secret.ciphertext,
      secretKeyVersion: endpoint.secret.keyVersion,
      createdAt: endpoint.createdAt,
      rotatedAt: endpoint.rotatedAt,
      version: endpoint.version,
    };
  }

  static toEntity(row: WebhookEndpointRow): WebhookEndpoint {
    return new WebhookEndpoint({
      id: row.id,
      workflowId: row.workflowId,
      nodeId: row.nodeId,
      secret: {
        ciphertext: row.secretCiphertext,
        keyVersion: row.secretKeyVersion,
      },
      createdAt: row.createdAt,
      rotatedAt: row.rotatedAt,
      version: row.version,
    });
  }
}
