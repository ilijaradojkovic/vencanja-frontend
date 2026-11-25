/**
 * Temporary service used by the M0 architecture spike: it stands in for the
 * guest lookup that later milestones read from Postgres, so the spike can prove
 * that a Next.js server component and the Hono API call the same service.
 */
export type SpikeGuest = {
  token: string;
  name: string;
  eventType: 'wedding' | 'celebration';
};

const GUESTS: readonly SpikeGuest[] = [
  { token: 'demo-jelena', name: 'Jelena Petrović', eventType: 'wedding' },
  { token: 'demo-luka', name: 'Luka Jovanović', eventType: 'celebration' },
];

export const getGuestByToken = (token: string): SpikeGuest | null =>
  GUESTS.find((guest) => guest.token === token) ?? null;
