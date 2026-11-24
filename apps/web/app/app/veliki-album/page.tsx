import { findEventForOwner, toWeddingPayload } from '@uspomena/api/server-only';
import { redirect } from 'next/navigation';

import { BigAlbumPage } from '@/features/photos/album/BigAlbumPage';
import { getServerAuth } from '@/lib/auth/server';
import { eventNames } from '@/lib/event';

export const metadata = { title: 'Veliki album · Uspomena' };

/** UC-46 – UC-49: the big album (wall, per guest, slideshow). */
export default async function BigAlbumRoute() {
  const supabase = await getServerAuth();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!data.user) redirect('/login?next=%2Fapp%2Fveliki-album');
  const event = await findEventForOwner(data.user.id);
  if (!event) redirect('/onboarding');
  const wedding = toWeddingPayload(event);
  return <BigAlbumPage event={{ id: wedding.id, names: eventNames(wedding), date: wedding.date }} />;
}
