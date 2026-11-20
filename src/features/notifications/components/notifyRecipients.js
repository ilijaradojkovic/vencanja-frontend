export const notifyStats = (guests, wedding) => {
  const viaQr = !!wedding?.settings?.galleryViaQr;
  const subscribers = wedding?.photoSubscribers || [];
  const guestPending = guests.filter((g) => g.photoNotify?.email && !g.photoNotify.sentAt);
  const subscriberPending = viaQr ? subscribers.filter((x) => !x.sentAt) : [];
  return {
    guestPending,
    subscriberPending,
    toSend: guestPending.length + subscriberPending.length,
    alreadySent: guests.filter((g) => g.photoNotify?.sentAt).length + subscribers.filter((x) => x.sentAt).length,
    withoutEmail: guests.filter((g) => !g.photoNotify?.email),
    subscribersBlocked: viaQr ? 0 : subscribers.filter((x) => !x.sentAt).length,
  };
};

export const readyIntro = (name) => `Dragi ${name}, slike sa našeg venčanja su spremne! Pogledajte šta su gosti uslikali:`;

export const readyMessage = (wedding, name, link) => `${readyIntro(name)} ${link}\n${wedding.partner1} i ${wedding.partner2}`;
