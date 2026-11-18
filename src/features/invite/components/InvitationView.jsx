import { getInvitationTemplate } from '../templates';

/** Prikazuje pozivnicu u izabranom templejtu (vidi features/invite/templates). */
export default function InvitationView({ wedding, guestName, children }) {
  const { Component } = getInvitationTemplate(wedding.invitation?.templateId);
  return (
    <Component wedding={wedding} guestName={guestName}>
      {children}
    </Component>
  );
}
