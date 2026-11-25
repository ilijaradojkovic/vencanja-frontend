import i18n from '../../../app/config/i18n';
import { HAND, jitter } from '../utils/polaroid';

export const TAPES = ['rgba(240,214,160,0.8)', 'rgba(186,220,205,0.8)', 'rgba(240,190,196,0.8)', 'rgba(200,200,235,0.8)'];

export default function Polaroid({ photo, index = 0, width, showMessage, onOpen, tilt = 6, shift = 0, className = 'ba-polaroid', style, as }) {
  const Tag = as || (onOpen ? 'button' : 'div');
  const rot = jitter(photo.id, 1) * tilt;
  const dx = jitter(photo.id, 2) * shift;
  const dy = jitter(photo.id, 3) * shift * 0.8;
  return (
    <Tag type={Tag === 'button' ? 'button' : undefined} onClick={onOpen} className={className}
      aria-label={Tag === 'button' ? i18n.t('common:lightbox.photoFrom', { name: photo.senderName }) : undefined}
      style={{
        '--r': `${rot}deg`, '--dx': `${dx}px`, '--dy': `${dy}px`,
        width, containerType: 'inline-size', position: 'relative', display: 'block', padding: 0, border: 'none',
        background: 'transparent', textAlign: 'center', cursor: onOpen ? 'zoom-in' : 'default',
        ...style,
      }}>
      <span style={{ display: 'block', position: 'relative', background: '#FFFFFF', padding: '5cqw 5cqw 0' }}>
        <span aria-hidden="true" style={{ position: 'absolute', top: '-4.5cqw', left: '50%', width: '38%', height: 'max(10px, 9cqw)',
          transform: `translateX(-50%) rotate(${jitter(photo.id, 9) * 7}deg)`, background: TAPES[index % TAPES.length], boxShadow: '0 0 1px rgba(0,0,0,0.12)' }} />
        <span style={{ display: 'block', aspectRatio: '1', overflow: 'hidden', background: '#E9E4DA' }}>
          <img src={photo.url} alt="" loading="lazy" decoding="async" draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: 'saturate(0.94) contrast(1.03)' }} />
        </span>
        <span style={{ display: 'block', padding: '4cqw 4px 7cqw', fontFamily: HAND, color: '#3B3A44', lineHeight: 1.05 }}>
          <span style={{ display: 'block', fontSize: 'max(13px, 11cqw)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {photo.senderName}
          </span>
          {showMessage && photo.message && (
            <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 'max(12px, 8.5cqw)', marginTop: 2, opacity: 0.85 }}>
              {photo.message}
            </span>
          )}
        </span>
      </span>
    </Tag>
  );
}
