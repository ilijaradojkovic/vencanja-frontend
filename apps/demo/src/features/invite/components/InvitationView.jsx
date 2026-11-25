import { getInvitationTemplate } from '../templates';

export default function InvitationView({ wedding, guestName, children }) {
  const { Component } = getInvitationTemplate(wedding.invitation?.templateId);
  return (
    <Component wedding={wedding} guestName={guestName}>
      {children}
    </Component>
  );
}
