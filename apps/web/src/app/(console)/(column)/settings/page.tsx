import { redirect } from 'next/navigation';
import { ACCOUNT_HREF } from '@/operations/app-routes';

export default function SettingsPage() {
  redirect(ACCOUNT_HREF);
}
