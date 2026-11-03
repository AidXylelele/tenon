import type { User } from '@/libs/data-access/types';

// Whether the user may change automations: publish, start, control and connect (002 FR-031).
// The console only hides what the API would refuse; the API decides.
export function canAuthor(user: User | null): boolean {
  return user?.role === 'admin' || user?.role === 'editor';
}
