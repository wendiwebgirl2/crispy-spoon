import React from 'react'
import { api } from './api.js'
import { Icon } from './shared.jsx'

// Publish status — per client, the episode on air now and the one in
// production (with its stage), from GET /api/episode-status. Opened from the
// Studio landing page; a one-line version sits at the top of each client page.

const fmtDay = (d) => {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};
const fmtWhen = (s) => {
  const m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return '—';
  if (!m[2]) return fmtDay(m[1]);
  const h = +m[2];
  return `${fmtDay(m[1])}, ${h % 12 || 12}:${m[3]} ${h < 12 ? 'AM' : 'PM'}`;
};

// Colour per stage: the further along, the greener.
const STAGE_COLOR = {
  writing: 'var(--text-3)', changes: 'var(--warn)', approval: 'var(--accent)',
  producing: 'var(--p-navy)', ready: 'var(--warn)', scheduled: 'var(--ok)',
};

function StageChip({ next }) {
  if (!next) return null;
  const c = STAGE_COLOR[next.stage] || 'var(--text-3)';
  return (
    <span className="mono" style={{ fontSize: 12, color: c, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flex: 'none' }} />{next.stageLabel}
    </span>
  );
}

const COLS = [
  { k: 'client', label: 'Client', val: (r) => r.clientName },
  { k: 'current', label: 'On air now', val: (r) => (r.current ? r.current.airDate : null) },
  { k: 'next', label: 'In production', val: (r) => (r.next ? r.next.num : null) },
  { k: 'stage', label: 'Stage', val: (r) => (r.next ? r.next.stageOrder : null) },
  { k: 'nextAir', label: 'Next post', val: (r) => (r.next ? r.next.nextAir : null) },
];

export function PublishStatusView({ onOpen, onBack }) {
  const [rows, setRows] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [sort, setSort] = React.useState({ k: 'client', dir: 'asc' });
  const [showEmpty, setShowEmpty] = React.useState(false);
  React.useEffect(() => {
    api.episodeStatus().then((r) => setRows(Array.isArray(r) ? r : [])).catch((e) => { setErr(e.message || 'Could not load publish status.'); setRows([]); });
  }, []);

  const th = { textAlign: 'left', fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-4)', padding: '8px 12px', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' };
  const td = { padding: '10px 12px', fontSize: 13, borderTop: '1px solid var(--border)', verticalAlign: 'top' };

  const active = (rows || []).filter((r) => r.hasEpisodes);
  const empty = (rows || []).filter((r) => !r.hasEpisodes);
  const col = COLS.find((c) => c.k === sort.k) || COLS[0];
  const sorted = active.slice().sort((a, b) => {
    const va = col.val(a), vb = col.val(b);
    const ea = va == null || va === '', eb = vb == null || vb === '';
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
    return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * (sort.dir === 'desc' ? -1 : 1);
  });
  const idle = active.filter((r) => !r.next).length;

  return (
    <div className="fade-in" style={{ padding: 'var(--pad)', minWidth: 0 }}>
      {onBack && <button className="btn sm" style={{ marginBottom: 12 }} onClick={onBack}><Icon name="arrow-l" size={12} /> Studio</button>}
      <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
        What's on air for each client, and the next episode in production. Click a row to open where that episode's work is.
        {idle > 0 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>{idle} client{idle === 1 ? ' has' : 's have'} nothing in production.</span>}
      </div>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      {rows === null ? <div className="mono">Loading…</div> : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 820 }}>
            <thead><tr>
              {COLS.map((c) => {
                const on = sort.k === c.k;
                return (
                  <th key={c.k} style={{ ...th, color: on ? 'var(--text)' : th.color }} title={`Sort by ${c.label}`}
                    onClick={() => setSort(on ? { k: c.k, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { k: c.k, dir: 'asc' })}>
                    {c.label}<span style={{ marginLeft: 4, opacity: on ? 1 : 0.3 }}>{on ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </th>
                );
              })}
            </tr></thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.clientId} onClick={() => onOpen && onOpen(r.clientId, r.next ? r.next.openView : 'planner')}
                  style={{ cursor: 'pointer' }} title={r.next ? `Open ${r.next.openView} for ${r.clientName}` : `Open the planner for ${r.clientName}`}>
                  <td style={{ ...td, fontWeight: 600 }}>{r.clientName}</td>
                  <td style={td}>
                    {r.current ? (
                      <>
                        <span style={{ fontWeight: 700 }}>E{r.current.num}</span>
                        <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}> · aired {fmtDay(r.current.airDate)}</span>
                        {r.current.postsTotal > 0 && (
                          <div className="mono" style={{ fontSize: 11, marginTop: 2, color: r.current.postsOut >= r.current.postsTotal ? 'var(--ok)' : 'var(--warn)' }}>
                            {r.current.postsOut}/{r.current.postsTotal} posts out
                          </div>
                        )}
                      </>
                    ) : <span className="mono" style={{ color: 'var(--text-4)' }}>Nothing aired yet</span>}
                  </td>
                  <td style={td}>
                    {r.next ? (
                      <>
                        <span style={{ fontWeight: 700 }}>E{r.next.num}</span>
                        {r.next.title && <span style={{ color: 'var(--text-2)' }}> · {r.next.title}</span>}
                        {r.moreInProduction > 0 && <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>+{r.moreInProduction} more after it</div>}
                      </>
                    ) : <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>⚠ Nothing in production</span>}
                  </td>
                  <td style={td}><StageChip next={r.next} /></td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.next && r.next.nextAir ? fmtWhen(r.next.nextAir) : <span style={{ color: 'var(--text-4)' }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sorted.length && <div className="mono" style={{ padding: 14, color: 'var(--text-3)' }}>No client has episodes yet.</div>}
        </div>
      )}
      {empty.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button className="btn sm" onClick={() => setShowEmpty(!showEmpty)}>{showEmpty ? '▾' : '▸'} Clients with no episodes yet ({empty.length})</button>
          {showEmpty && <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>{empty.map((r) => r.clientName).join(' · ')}</div>}
        </div>
      )}
    </div>
  );
}

// One-line version for the top of a client page: "E18 on air · E19 in production (stage)".
export function PublishStatusLine({ clientId, onOpen }) {
  const [row, setRow] = React.useState(null);
  React.useEffect(() => {
    let live = true;
    api.episodeStatus(clientId).then((r) => { if (live) setRow(Array.isArray(r) ? r[0] || null : null); }).catch(() => {});
    return () => { live = false; };
  }, [clientId]);
  if (!row || !row.hasEpisodes) return null;
  return (
    <div className="card" style={{ padding: '10px 14px', marginBottom: 16, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="label" style={{ margin: 0 }}>PUBLISH STATUS</span>
      <span style={{ fontSize: 14 }}>
        {row.current ? <><b>E{row.current.num}</b> on air <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>(aired {fmtDay(row.current.airDate)})</span></> : <span style={{ color: 'var(--text-3)' }}>Nothing aired yet</span>}
      </span>
      <span style={{ color: 'var(--text-4)' }}>·</span>
      {row.next ? (
        <button className="btn sm" onClick={() => onOpen && onOpen(row.next.openView)} title="Open where this episode's work is">
          <b>E{row.next.num}</b>&nbsp;in production — <StageChip next={row.next} />
        </button>
      ) : <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>⚠ Nothing in production</span>}
    </div>
  );
}
