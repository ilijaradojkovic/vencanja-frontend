/**
 * Enum vrednosti koje šalje/prima backend.
 * Vrednosti moraju da se poklapaju sa BE (vidi API.md).
 */

/** Odgovor gosta na pozivnicu (guest.rsvp.status) */
export const RsvpStatus = Object.freeze({
  YES: 'yes',
  NO: 'no',
  PENDING: 'pending',
});

/** Strana sa koje je gost (guest.side) */
export const GuestSide = Object.freeze({
  BRIDE: 'mlada',
  GROOM: 'mladozenja',
  SHARED: 'zajednicki',
});

/** Moderacija fotografija (photo.status) */
export const PhotoStatus = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  HIDDEN: 'hidden',
});

/** Kategorija fotografije koju gost šalje (photo.category) */
export const PhotoCategory = Object.freeze({
  MEMORIES: 'memories',
  WEDDING: 'wedding',
});

/** Status zahteva za custom dizajn (designRequest.status) */
export const DesignRequestStatus = Object.freeze({
  RECEIVED: 'received',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  DONE: 'done',
});

/** Šta se dizajnira (designRequest.type) */
export const DesignRequestType = Object.freeze({
  INVITATION: 'invitation',
  ALBUM: 'album',
  BOTH: 'both',
  BIG_ALBUM: 'big_album', // veliki album / zid polaroida (poster, platno, fajl za štampu)
});
