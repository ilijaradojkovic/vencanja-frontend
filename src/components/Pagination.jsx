import Icon from './Icon';

function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pages - 1, page + 1);
  if (from > 2) out.push('…');
  for (let p = from; p <= to; p++) out.push(p);
  if (to < pages - 1) out.push('…');
  out.push(pages);
  return out;
}

export default function Pagination({ page, pageSize, total, onPage, onPageSize, sizes = [10, 25, 50, 100], label = 'stavki' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className="pagination" aria-label="Straničenje">
      <span className="small muted">
        Prikazano <strong style={{ fontWeight: 500, color: 'var(--ink)' }}>{from}–{to}</strong> od {total} {label}
      </span>

      {pages > 1 && (
        <div className="row" style={{ '--gap': '4px', flexWrap: 'nowrap' }}>
          <button className="icon-btn icon-btn-sm" onClick={() => onPage(page - 1)} disabled={page === 1} aria-label="Prethodna strana">
            <Icon name="chevronLeft" size={18} />
          </button>
          {pageList(page, pages).map((p, i) => (p === '…' ? (
            <span key={`gap-${i}`} className="pagination-gap" aria-hidden="true">…</span>
          ) : (
            <button key={p} className="pagination-page" aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}
              aria-label={`Strana ${p}`}>
              {p}
            </button>
          )))}
          <button className="icon-btn icon-btn-sm" onClick={() => onPage(page + 1)} disabled={page === pages} aria-label="Sledeća strana">
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      )}

      {onPageSize && (
        <label className="row small muted" style={{ '--gap': '8px', flexWrap: 'nowrap' }}>
          Po strani
          <select className="select" style={{ width: 'auto', minHeight: 36, padding: '0 30px 0 12px' }} value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}>
            {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      )}
    </nav>
  );
}
