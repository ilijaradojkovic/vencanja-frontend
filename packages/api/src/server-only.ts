/**
 * Server-only entry point for Next.js server components (SPEC §3.3). Importing
 * this module from browser code fails the build, so server components can reuse
 * the API's business rules without exposing database, Storage or email code.
 */
import 'server-only';

export { findEventForOwner, toWeddingPayload, type WeddingPayload } from './services/events.ts';
export { getGuestByToken, type SpikeGuest } from './services/guest.ts';
export { getProfileById, type ProfileRow } from './services/profiles.ts';
export { makeThumbnailProbe, type ThumbnailProbe } from './services/image.ts';
