import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../../components/LanguageSwitcher';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { fetchInvitation, submitRsvp } from '../services/invite.service';
import InvitationView from '../components/InvitationView';
import NotifyEmailForm from '../components/NotifyEmailForm';
import { galleryStatusText } from '../components/galleryStatus';
import { envelopeColor } from '../templates';
import Icon from '../../../components/Icon';
import { PageLoading, Spinner } from '../../../components/ui';
import { formatDate, personsAcc } from '../../../utils/format';
import { maxCompanions } from '../../../utils/gallery';
import { CompanionType, RsvpStatus } from '../../../app/config/enums';
import NotFound from '../../common/pages/not-found.page';
import { eventInitials } from '../../../utils/event';

function CompanionsField({ guest, count, setCount, names, setNames, picked, setPicked }) {
  const { t } = useTranslation('invite');
  const type = guest.companions?.type || CompanionType.NONE;
  const max = maxCompanions(guest);

  if (type === CompanionType.NAMED) {
    return (
      <fieldset className="stack" style={{ '--gap': '6px', border: 'none', padding: '10px 14px', margin: 0, background: 'var(--bg)', borderRadius: 12 }}>
        <legend className="small" style={{ fontWeight: 500, padding: 0, marginBottom: 4 }}>{t('rsvp.whoComes')}</legend>
        {guest.companions.names.map((n) => (
          <label key={n} className="check" style={{ minHeight: 0, padding: '4px 0' }}>
            <input type="checkbox" checked={picked.includes(n)}
              onChange={() => setPicked(picked.includes(n) ? picked.filter((x) => x !== n) : [...picked, n])} />
            <span>{n}</span>
          </label>
        ))}
        <span className="xs muted">{t('rsvp.total', { persons: personsAcc(1 + picked.length) })}</span>
      </fieldset>
    );
  }

  if (type === CompanionType.OPEN && max > 0) {
    const setAt = (i, v) => setNames(names.map((x, j) => (j === i ? v : x)));
    const resize = (n) => {
      setCount(n);
      setNames(Array.from({ length: n - 1 }, (_, i) => names[i] || ''));
    };
    return (
      <div className="stack" style={{ '--gap': '10px', padding: '10px 14px', background: 'var(--bg)', borderRadius: 12 }}>
        <div className="row between">
          <span>{t('rsvp.persons')} <span className="xs muted">{t('rsvp.youPlus', { count: max })}</span></span>
          <div className="row" style={{ '--gap': '14px' }}>
            <button type="button" className="icon-btn" aria-label={t('rsvp.decrease')} disabled={count <= 1} onClick={() => resize(count - 1)}><Icon name="minus" /></button>
            <strong style={{ minWidth: 16, textAlign: 'center', fontSize: 18 }} aria-live="polite">{count}</strong>
            <button type="button" className="icon-btn" aria-label={t('rsvp.increase')} disabled={count >= max + 1} onClick={() => resize(count + 1)}><Icon name="plus" /></button>
          </div>
        </div>
        {count > 1 && (
          <div className="stack" style={{ '--gap': '8px' }}>
            <span className="small">{t('rsvp.companionNames')} <span className="xs muted">{t('custom.optional')}</span></span>
            {names.map((v, i) => (
              <input key={i} className="input" value={v} onChange={(e) => setAt(i, e.target.value)}
                placeholder={t('rsvp.companionN', { n: i + 1 })} aria-label={t('rsvp.companionNameN', { n: i + 1 })} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

function NotifyStatus({ token, guest, accent }) {
  const { t } = useTranslation('invite');
  const [open, setOpen] = useState(false);
  if (guest.notifyEmail) {
    return (
      <p className="xs muted" style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="mail" size={14} /> {t('rsvp.willNotifyPhotos', { email: guest.notifyEmail })}
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
        <Icon name="mail" size={16} /> {t('rsvp.notifyMePhotos')}
      </button>
    );
  }
  return (
    <div style={{ width: '100%', textAlign: 'left' }}>
      <NotifyEmailForm token={token} initialEmail={guest.prefillEmail} accent={accent}
        onDone={() => setOpen(false)} onSkip={() => setOpen(false)} skipLabel={t('common:actions.cancel')} />
    </div>
  );
}

function RsvpForm({ token, guest, deadline, accent }) {
  const { t } = useTranslation('invite');
  const dispatch = useAppDispatch();
  const saving = useAppSelector((s) => s.invite.rsvpSaving);
  const answered = guest.rsvp.status !== RsvpStatus.PENDING;
  const max = maxCompanions(guest);
  const [step, setStep] = useState(answered ? 'done' : 'form');
  const [status, setStatus] = useState(answered ? guest.rsvp.status : null);
  const initialCount = guest.rsvp.status === RsvpStatus.YES ? Math.min(guest.rsvp.persons || 1, max + 1) : max + 1;
  const [count, setCount] = useState(initialCount);
  const [names, setNames] = useState(() => Array.from({ length: initialCount - 1 }, (_, i) => guest.rsvp.companions?.[i] || ''));
  const [picked, setPicked] = useState(guest.rsvp.companions || []);
  const [note, setNote] = useState(guest.rsvp.note || '');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!status) return setError(t('rsvp.chooseError'));
    setError('');
    const named = guest.companions?.type === CompanionType.NAMED;
    const companions = status !== RsvpStatus.YES ? [] : named ? picked : names.map((n) => n.trim()).filter(Boolean);
    const persons = status !== RsvpStatus.YES ? 0 : named ? 1 + picked.length : max > 0 ? count : 1;
    const res = await dispatch(submitRsvp({ token, status, persons, companions, note }));
    if (res.meta.requestStatus === 'fulfilled') setStep(guest.notifyEmail ? 'done' : 'notify');
    else setError(res.payload?.message || t('common:errors.sendFailed'));
  };

  if (step === 'notify') {
    const yes = guest.rsvp.status === RsvpStatus.YES;
    return (
      <div className="stack reveal" style={{ '--gap': '14px' }}>
        <div className="stack" style={{ alignItems: 'center', textAlign: 'center', '--gap': '8px' }}>
          <span style={{ color: accent }}><Icon name="checkCircle" size={44} stroke={1.5} /></span>
          <h2>{yes ? t('rsvp.thanksYes') : t('rsvp.thanks')}</h2>
          <p className="muted">{t('rsvp.askNotify')}</p>
        </div>
        <NotifyEmailForm token={token} initialEmail={guest.prefillEmail} accent={accent}
          onDone={() => setStep('done')} onSkip={() => setStep('done')} />
      </div>
    );
  }

  if (step === 'done') {
    const yes = guest.rsvp.status === RsvpStatus.YES;
    const comp = guest.rsvp.companions || [];
    return (
      <div className="stack reveal" style={{ alignItems: 'center', textAlign: 'center', '--gap': '10px' }}>
        <span style={{ color: accent }}><Icon name="checkCircle" size={48} stroke={1.5} /></span>
        <h2>{yes ? t('rsvp.seeYou') : t('rsvp.thanks')}</h2>
        <p className="muted">
          {yes ? t('rsvp.confirmedFor', { persons: personsAcc(guest.rsvp.persons) }) : t('rsvp.sorry')}
        </p>
        {yes && comp.length > 0 && <p className="small muted">{t('rsvp.withYou', { names: comp.join(', ') })}</p>}
        {guest.rsvp.note && <p className="small muted">{t('rsvp.noteValue', { note: guest.rsvp.note })}</p>}
        <button className="btn btn-ghost" onClick={() => setStep('form')}>{t('rsvp.edit')}</button>
        <NotifyStatus token={token} guest={guest} accent={accent} />
      </div>
    );
  }

  const pill = (value, label) => (
    <button type="button" aria-pressed={status === value} onClick={() => setStatus(value)}
      className="btn btn-lg" style={status === value
        ? { background: accent, color: '#F6F3EE', borderColor: accent }
        : { background: '#fff', color: 'var(--ink)', borderColor: 'var(--line-strong)' }}>
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="stack" style={{ '--gap': '18px' }}>
      <div className="stack" style={{ '--gap': '4px' }}>
        <h2>{t('rsvp.title')}</h2>
        {deadline && <p className="small muted">{t('rsvp.deadline', { date: formatDate(deadline) })}</p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }} role="group" aria-label={t('rsvp.attendingAria')}>
        {pill(RsvpStatus.YES, t('rsvp.yes'))}
        {pill(RsvpStatus.NO, t('rsvp.no'))}
      </div>
      {status === RsvpStatus.YES && (
        <CompanionsField guest={guest} count={count} setCount={setCount} names={names} setNames={setNames} picked={picked} setPicked={setPicked} />
      )}
      <label className="field">
        <span>{t('rsvp.note')}</span>
        <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn btn-lg" style={{ background: accent, color: '#F6F3EE' }} disabled={saving}>
        {saving ? <Spinner light /> : t('rsvp.confirm')}
      </button>
    </form>
  );
}

export default function GuestInvitation() {
  const { t } = useTranslation('invite');
  const { token } = useParams();
  const dispatch = useAppDispatch();
  const { guest, wedding, status, error } = useAppSelector((s) => s.invite);
  const [opened, setOpened] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    dispatch(fetchInvitation(token));
  }, [dispatch, token]);

  if (status === 'failed') return <NotFound title={t('errors.invitationNotFound')} text={error} />;
  if (status !== 'succeeded' || !guest || guest.token !== token) return <PageLoading />;

  const accent = envelopeColor(wedding.invitation);
  const galleryOpen = !!wedding.gallery?.open;

  const open = () => {
    setAnimating(true);
    setTimeout(() => setOpened(true), 650);
  };

  if (!opened) {
    return (
      <div className="envelope-screen" style={{ background: accent }}>
        <div style={{ position: 'absolute', top: 16, right: 16 }}><LanguageSwitcher dark /></div>
        <p className="eyebrow" style={{ color: 'var(--champagne)' }}>{t('envelope.eyebrow')}</p>
        <div className={`envelope ${animating ? 'open' : ''}`} aria-hidden="true">
          <div className="body" />
          <svg className="flap" viewBox="0 0 260 106" preserveAspectRatio="none" width="260" height="106">
            <path d="M0 0 H260 L130 106 Z" fill="#EDE5D3" stroke="#D9C9A3" strokeWidth="1.5" />
          </svg>
          <div className="seal">{eventInitials(wedding).split('').join('&')}</div>
        </div>
        <div className="stack" style={{ '--gap': '10px' }}>
          <h1 style={{ fontWeight: 500, fontSize: 42 }}>{guest.name},<br />{t('envelope.invited')}</h1>
          <p style={{ color: 'var(--champagne-2)' }}>{t('envelope.text', { p1: wedding.partner1, p2: wedding.partner2 })}</p>
        </div>
        <button className="btn btn-champagne btn-lg" onClick={open} disabled={animating}>{t('envelope.open')}</button>
      </div>
    );
  }

  return (
    <div className="guest-page">
      <div className="guest-wrap reveal" style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 5 }}><LanguageSwitcher /></div>
        <InvitationView wedding={wedding} guestName={guest.name}>
          <section style={{ padding: '8px 16px 0' }}>
            <div className="card" style={{ padding: '26px 20px' }}>
              <RsvpForm token={token} guest={guest} deadline={wedding.rsvpDeadline} accent={accent} />
            </div>
          </section>
          <section style={{ padding: '20px 16px 48px' }}>
            <div className="card card-cream stack" style={{ '--gap': '12px', padding: '26px 22px' }}>
              <p className="eyebrow">{t('albumOfMemories')}</p>
              {galleryOpen ? (
                <>
                  <h2>{t('album.readyTitle')}</h2>
                  <p style={{ color: 'var(--ink-2)' }}>{t('album.readyText')}</p>
                  <Link to={`/i/${token}/galerija`} className="btn btn-lg" style={{ background: accent, color: '#F6F3EE' }}>
                    <Icon name="image" /> {t('gallery.view')}
                  </Link>
                  <Link to={`/i/${token}/upload`} className="btn btn-outline btn-lg">
                    <Icon name="upload" /> {t('sendPhotos')}
                  </Link>
                </>
              ) : (
                <>
                  <h2>{t('album.title')}</h2>
                  <p style={{ color: 'var(--ink-2)' }}>
                    {t('album.text')}
                  </p>
                  <Link to={`/i/${token}/upload`} className="btn btn-lg" style={{ background: 'var(--ink)', color: '#F6F3EE' }}>
                    <Icon name="upload" /> {t('sendPhotos')}
                  </Link>
                  <p className="xs muted">{galleryStatusText(wedding.gallery)}</p>
                </>
              )}
            </div>
          </section>
        </InvitationView>
      </div>
    </div>
  );
}
