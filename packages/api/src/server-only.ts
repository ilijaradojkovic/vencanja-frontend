/**
 * Server-only entry point for Next.js server components (SPEC §3.3). Importing
 * this module from browser code fails the build, so server components can reuse
 * the API's business rules without exposing database, Storage or email code.
 */
import 'server-only';

export { getGuestByToken, type SpikeGuest } from './services/guest.ts';
export { makeThumbnailProbe, type ThumbnailProbe } from './services/image.ts';
