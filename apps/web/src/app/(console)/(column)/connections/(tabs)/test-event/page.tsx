import type { Metadata } from 'next';
import { EventSenderPage } from '@/spaces/automation/modules/event-sender';

export const metadata: Metadata = { title: 'Send an event' };

export default function EventsPage() {
  return <EventSenderPage />;
}
