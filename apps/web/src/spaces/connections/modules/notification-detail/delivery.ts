import type { DeliveryStatus } from '@/libs/data-access/types';
import type { Tone } from '@/libs/ui/composites/status';

// The words of a notification's delivery states and the tone that colours each (research R8).

const DELIVERY: Record<
  DeliveryStatus,
  { readonly label: string; readonly tone: Tone }
> = {
  pending: { label: 'Retrying', tone: 'waiting' },
  delivered: { label: 'Delivered', tone: 'done' },
  failed: { label: 'Failed', tone: 'failed' },
};

// The word of a delivery's status: "Retrying".
export function deliveryLabel(status: DeliveryStatus): string {
  return DELIVERY[status].label;
}

// The tone that colours a delivery's status.
export function deliveryTone(status: DeliveryStatus): Tone {
  return DELIVERY[status].tone;
}
