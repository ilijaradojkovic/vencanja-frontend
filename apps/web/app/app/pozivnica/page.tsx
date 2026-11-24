import { findEventForOwner, listGuests } from '@uspomena/api/server-only';
import { redirect } from 'next/navigation';

import { InvitationEditor } from '@/features/invite/InvitationEditor';
import { getServerAuth } from '@/lib/auth/server';

export const metadata = { title: 'Pozivnica · Uspomena' };

export default async function InvitationRoute() {
  const supabase = await getServerAuth();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect('/login?next=%2Fapp%2Fpozivnica');

  const event = await findEventForOwner(data.user.id);
  if (!event) redirect('/onboarding');

  const guests = await listGuests(event.id);
  return <InvitationEditor sampleGuestName={guests[0]?.name} />;
}
