import { findEventForOwner } from '@uspomena/api/server-only';
import { redirect } from 'next/navigation';

import { PhotosPage } from '@/features/photos/PhotosPage';
import { getServerAuth } from '@/lib/auth/server';

export const metadata = { title: 'Fotografije · Uspomena' };

/** UC-34 – UC-39: the organizer's photo moderation; data comes from the API. */
export default async function PhotosRoute() {
  const supabase = await getServerAuth();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect('/login?next=%2Fapp%2Ffotografije');
  const event = await findEventForOwner(data.user.id);
  if (!event) redirect('/onboarding');
  return <PhotosPage eventId={event.id} />;
}
