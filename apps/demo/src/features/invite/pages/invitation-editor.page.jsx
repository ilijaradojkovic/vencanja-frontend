import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { nanoid } from '@reduxjs/toolkit';
import { useAppDispatch, useAppSelector } from '../../../app/hooks';
import { updateWedding } from '../../wedding/services/wedding.service';
import { guestsSelectors } from '../../guests/store/guests.store';
import { toast } from 'react-toastify';
import InvitationView from '../components/InvitationView';
import Icon from '../../../components/Icon';
import { Spinner } from '../../../components/ui';
import { INVITATION_TEMPLATES, getInvitationTemplate } from '../templates';
import CustomDesignModal from '../components/CustomDesignModal';
import { fetchRequests } from '../../requests/services/requests.service';
import { REQUEST_STATUS } from '../../../utils/format';
import { isCelebration } from '../../../utils/event';

const pick = (w) => ({
  partner1: w.partner1,
  partner2: w.partner2,
  occasion: w.occasion || '',
  date: w.date,
  rsvpDeadline: w.rsvpDeadline,
  invitation: w.invitation,
});

function TemplateThumb({ wedding, draft, templateId }) {
  const W = 380;
  const scale = 0.42;
  const t = getInvitationTemplate(templateId);
  const accentColor = t.accents.includes(draft.invitation.accentColor) ? draft.invitation.accentColor : t.accents[0];
  return (
    <span aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', borderRadius: 10, overflow: 'hidden', background: 'var(--bg)', border: '1px solid var(--line)' }}>
      <span style={{ width: W * scale, height: 210, overflow: 'hidden', display: 'block', pointerEvents: 'none' }}>
        <span style={{ display: 'block', width: W, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <InvitationView wedding={{ ...wedding, ...draft, invitation: { ...draft.invitation, templateId, accentColor } }} />
        </span>
      </span>
    </span>
  );
}

export default function InvitationEditor() {
  const { t } = useTranslation('invite');
  const dispatch = useAppDispatch();
  const wedding = useAppSelector((s) => s.wedding.data);
  const saving = useAppSelector((s) => s.wedding.saving);
  const sampleGuest = useAppSelector(guestsSelectors.selectAll)[0];
  const [draft, setDraft] = useState(() => pick(wedding));
  const [customOpen, setCustomOpen] = useState(false);
  const closeCustom = useCallback(() => setCustomOpen(false), []);
  const requests = useAppSelector((s) => s.requests);

  useEffect(() => {
    if (requests.status === 'idle') dispatch(fetchRequests());
  }, [dispatch, requests.status]);

  const activeRequest = requests.items.find((r) => (r.type === 'invitation' || r.type === 'both') && r.status !== 'done');

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(pick(wedding)), [draft, wedding]);
  const inv = draft.invitation;
  const setInv = (patch) => setDraft({ ...draft, invitation: { ...inv, ...patch } });
  const template = getInvitationTemplate(inv.templateId);
  const chooseTemplate = (tpl) =>
    setInv({ templateId: tpl.id, ...(tpl.accents.length && !tpl.accents.includes(inv.accentColor) ? { accentColor: tpl.accents[0] } : {}) });
  const setEvent = (id, patch) => setInv({ schedule: inv.schedule.map((e) => (e.id === id ? { ...e, ...patch } : e)) });

  const save = async () => {
    const res = await dispatch(updateWedding(draft));
    if (res.meta.requestStatus === 'fulfilled') toast.success(t('editor.saved'));
  };

  return (
    <>
      <div className="page-head">
        <div className="stack" style={{ '--gap': '6px' }}>
          <p className="eyebrow">{t('editor.eyebrow')}</p>
          <h1>{t('editor.title')}</h1>
        </div>
        <div className="row">
          {sampleGuest && <Link to={`/i/${sampleGuest.token}`} target="_blank" className="btn btn-outline"><Icon name="eye" size={18} /> {t('editor.openAsGuest')}</Link>}
          <button className="btn btn-soft" onClick={() => setDraft(pick(wedding))} disabled={!dirty || saving}>{t('editor.reset')}</button>
          <button className="btn btn-primary" onClick={save} disabled={!dirty || saving}>{saving ? <Spinner light /> : dirty ? t('editor.saveChanges') : t('editor.savedState')}</button>
        </div>
      </div>

      <div className="two-col">
        <div className="main stack" style={{ '--gap': '20px', flexBasis: 420 }}>
          <section className="card stack" aria-labelledby="tpl-h">
            <div className="stack" style={{ '--gap': '4px' }}>
              <h2 id="tpl-h">{t('editor.look')}</h2>
              <span className="small muted">{t('editor.lookHint')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }} role="radiogroup" aria-label={t('editor.templateAria')}>
              {INVITATION_TEMPLATES.map((tpl) => {
                const active = template.id === tpl.id;
                return (
                  <button key={tpl.id} role="radio" aria-checked={active} onClick={() => chooseTemplate(tpl)}
                    className="stack" style={{ position: 'relative', '--gap': '8px', padding: 8, borderRadius: 14, cursor: 'pointer', textAlign: 'left', background: '#fff',
                      border: active ? '2px solid var(--green)' : '1px solid var(--line)', boxShadow: active ? '0 0 0 3px rgba(45,74,62,0.12)' : 'none' }}>
                    <TemplateThumb wedding={wedding} draft={draft} templateId={tpl.id} />
                    {tpl.isNew && (
                      <span style={{ position: 'absolute', top: 14, left: 14, padding: '2px 8px', borderRadius: 999, background: 'var(--ink)', color: '#F6F3EE', fontSize: 11, fontWeight: 500, letterSpacing: '0.04em' }}>{t('editor.new')}</span>
                    )}
                    <span className="row between" style={{ fontWeight: 500 }}>
                      {tpl.name}
                      {active && <Icon name="checkCircle" size={18} />}
                    </span>
                    <span className="xs muted">{tpl.description}</span>
                  </button>
                );
              })}

              <button type="button" onClick={() => setCustomOpen(true)}
                className="stack" style={{ '--gap': '8px', padding: 8, borderRadius: 14, cursor: 'pointer', textAlign: 'left', background: '#fff', border: '1.5px dashed var(--line-strong)' }}>
                <span style={{ height: 212, borderRadius: 10, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 16,
                  background: 'linear-gradient(135deg, #F6F1E7 0%, #EFE6D6 50%, #E7EDE6 100%)', color: 'var(--ink)' }}>
                  <span className="stack" style={{ '--gap': '8px', alignItems: 'center' }}>
                    <span style={{ width: 52, height: 52, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', color: 'var(--gold, #7A5C24)', boxShadow: 'var(--shadow)' }}>
                      <Icon name="sparkle" size={26} />
                    </span>
                    <span className="serif" style={{ fontSize: 20, fontStyle: 'italic' }}>{t('editor.customTitle')}</span>
                    <span className="xs muted">{t('editor.customText')}</span>
                  </span>
                </span>
                <span className="row between" style={{ fontWeight: 500 }}>{t('common:nav.customDesign')} <Icon name="chevronRight" size={16} /></span>
                <span className="xs muted">{t('editor.customHint')}</span>
              </button>
            </div>
            {activeRequest && (
              <div className="row" style={{ '--gap': '10px', padding: 12, borderRadius: 12, background: 'var(--bg)', alignItems: 'center' }}>
                <Icon name="sparkle" size={18} />
                <span className="small grow">{t('editor.activeRequest')} <strong style={{ fontWeight: 500 }}>{REQUEST_STATUS[activeRequest.status] || activeRequest.status}</strong></span>
                <Link to="/app/custom-dizajn" className="btn btn-ghost btn-sm">{t('common:actions.details')}</Link>
              </div>
            )}
            {template.accents.length > 0 ? (
              <div className="stack" style={{ '--gap': '8px' }}>
                <span className="small" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{t('editor.accent')}</span>
                <div className="row" style={{ '--gap': '8px', flexWrap: 'wrap' }} role="group" aria-label={t('editor.colorAria')}>
                  {template.accents.map((c) => (
                    <button key={c} onClick={() => setInv({ accentColor: c })} aria-label={t('editor.colorValue', { color: c })} aria-pressed={inv.accentColor === c}
                      style={{ width: 40, height: 40, borderRadius: '50%', background: c, cursor: 'pointer',
                        border: inv.accentColor === c ? '3px solid var(--champagne)' : '3px solid transparent', boxShadow: inv.accentColor === c ? '0 0 0 2px var(--ink)' : 'none' }} />
                  ))}
                  <label className="row" style={{ '--gap': '6px' }}>
                    <input type="color" value={inv.accentColor || template.accents[0]} onChange={(e) => setInv({ accentColor: e.target.value })}
                      style={{ width: 40, height: 40, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
                    <span className="xs muted">{t('editor.customColor')}</span>
                  </label>
                </div>
              </div>
            ) : (
              <span className="small muted">{t('editor.ownPalette')}</span>
            )}
          </section>

          <section className="card stack" aria-labelledby="txt-h">
            <h2 id="txt-h">{t('editor.textAndDate')}</h2>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <label className="field grow"><span>{t('auth:fields.partner1')}</span><input className="input" value={draft.partner1} onChange={(e) => setDraft({ ...draft, partner1: e.target.value })} /></label>
              {isCelebration(wedding) ? (
                <label className="field grow"><span>{t('auth:fields.occasion')}</span><input className="input" value={draft.occasion} placeholder={t('auth:fields.occasionPlaceholder')} onChange={(e) => setDraft({ ...draft, occasion: e.target.value })} /></label>
              ) : (
                <label className="field grow"><span>{t('auth:fields.partner2')}</span><input className="input" value={draft.partner2} onChange={(e) => setDraft({ ...draft, partner2: e.target.value })} /></label>
              )}
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <label className="field grow"><span>{t('auth:fields.weddingDate')}</span><input className="input" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
              <label className="field grow"><span>{t('editor.rsvpDeadline')}</span><input className="input" type="date" value={draft.rsvpDeadline} onChange={(e) => setDraft({ ...draft, rsvpDeadline: e.target.value })} /></label>
            </div>
            <label className="field"><span>{t('editor.headline')}</span><input className="input" value={inv.headline} onChange={(e) => setInv({ headline: e.target.value })} /></label>
            <label className="field"><span>{t('editor.message')}</span><textarea className="textarea" rows={3} value={inv.message} onChange={(e) => setInv({ message: e.target.value })} /></label>
          </section>

          <section className="card stack" aria-labelledby="sch-h">
            <div className="row between">
              <h2 id="sch-h">{t('templates:schedule')}</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setInv({ schedule: [...inv.schedule, { id: nanoid(), time: '20:00', title: '', place: '', mapUrl: '' }] })}>
                <Icon name="plus" size={16} /> {t('editor.add')}
              </button>
            </div>
            {inv.schedule.map((e, i) => (
              <div key={e.id} className="stack" style={{ '--gap': '10px', padding: 14, borderRadius: 12, background: 'var(--bg)' }}>
                <div className="row" style={{ alignItems: 'flex-end' }}>
                  <label className="field" style={{ width: 120 }}><span>{t('editor.time')}</span><input className="input" type="time" value={e.time} onChange={(ev) => setEvent(e.id, { time: ev.target.value })} /></label>
                  <label className="field grow"><span>{t('editor.eventTitle')}</span><input className="input" value={e.title} onChange={(ev) => setEvent(e.id, { title: ev.target.value })} placeholder={t('editor.eventTitlePlaceholder')} /></label>
                  <button className="icon-btn" onClick={() => setInv({ schedule: inv.schedule.filter((x) => x.id !== e.id) })} aria-label={t('editor.removeItem', { n: i + 1 })}><Icon name="trash" size={18} /></button>
                </div>
                <label className="field"><span>{t('editor.place')}</span><input className="input" value={e.place} onChange={(ev) => setEvent(e.id, { place: ev.target.value })} placeholder={t('editor.placePlaceholder')} /></label>
                <label className="field"><span>{t('editor.mapUrl')}</span><input className="input" value={e.mapUrl} onChange={(ev) => setEvent(e.id, { mapUrl: ev.target.value })} placeholder="https://maps.google.com/…" /></label>
              </div>
            ))}
          </section>
        </div>

        <div className="side" style={{ position: 'sticky', top: 20, flexBasis: 380 }}>
          <p className="small muted" style={{ marginBottom: 10, textAlign: 'center' }}>{sampleGuest ? t('editor.previewAs', { name: sampleGuest.name }) : t('editor.preview')}</p>
          <div className="no-scrollbar" style={{ maxWidth: 400, margin: '0 auto', height: 'min(760px, 80vh)', overflowY: 'auto', borderRadius: 32, border: '10px solid var(--ink)', boxShadow: 'var(--shadow)', background: '#fff' }}>
            <InvitationView wedding={{ ...wedding, ...draft }} guestName={sampleGuest?.name || t('editor.guestName')}>
              <div style={{ padding: '8px 16px 32px' }}>
                <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
                  <h3>{t('rsvp.title')}</h3>
                  <span className="xs muted">{t('editor.rsvpPreview')}</span>
                </div>
              </div>
            </InvitationView>
          </div>
        </div>
      </div>
      {customOpen && <CustomDesignModal currentTemplateId={template.id} onClose={closeCustom} />}
    </>
  );
}
