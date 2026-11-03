import { redirect } from 'next/navigation';
import { WEBHOOKS_HREF } from '@/operations/app-routes';

export default function ConnectionsPage() {
  redirect(WEBHOOKS_HREF);
}
