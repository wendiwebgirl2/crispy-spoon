import React from 'react'
import { api } from './api.js'

// UTC 'YYYY-MM-DD HH:MM:SS' -> local date+time (the report shows both).
function fmt(s) {
  if (!s) return '—';
  const d = new Date(String(s).replace(' ', 'T') + 'Z');
  if (isNaN(d)) return String(s).slice(0, 16);
  return d.toLocaleString([], { month: 'short', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' });
}
function iso(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }

// Plain local 'YYYY-MM-DD' -> "Tue, Oct 28"; 'HH:MM' 24h -> "2:30 PM".
function fmtDay(d) {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return d || '—';
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(t) {
  const m = String(t || '').match(/^(\d{2}):(\d{2})/);
  if (!m) return '—';
  const h = +m[1];
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

const KIND_LABEL = { script: 'Script', cast: 'Cast', episode: 'Episode', distribution: 'Distribution' };

// Click-to-sort columns. Blank values always sort last; dates sort as dates
// because they are ISO-ish strings, text sorts case-insensitively.
const PROD_COLS = [
  { k: 'title', label: 'Piece' }, { k: 'pieceType', label: 'Piece type' }, { k: 'kind', label: 'Stage' }, { k: 'jobNumber', label: 'Job #' },
  { k: 'startedAt', label: 'Started' }, { k: 'sentAt', label: 'Sent' }, { k: 'approvedAt', label: 'Approved' },
  { k: 'changesAt', label: 'Changes' }, { k: 'finishedAt', label: 'Completed' }, { k: 'status', label: 'Status' },
];
const AIR_COLS = [
  { k: 'date', label: 'Air date' }, { k: 'time', label: 'Time' }, { k: 'channel', label: 'Channel' },
  { k: 'client_name', label: 'Client', allOnly: true }, { k: 'title', label: 'Episode / post' },
];
function sortRows(rows, sort, valueOf = (r, k) => r[k]) {
  if (!sort) return rows;
  const dir = sort.dir === 'desc' ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const va = valueOf(a, sort.k), vb = valueOf(b, sort.k);
    const ea = va == null || va === '', eb = vb == null || vb === '';
    if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
    return String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' }) * dir;
  });
}

export function ProductionReportView() {
  const now = new Date();
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
  const [start, setStart] = React.useState(iso(monthAgo));
  const [end, setEnd] = React.useState(iso(now));
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [tab, setTab] = React.useState('production'); // 'production' | 'air'
  const [clientId, setClientId] = React.useState('');
  const [clients, setClients] = React.useState([]);
  const [air, setAir] = React.useState(null);
  // { k, dir } — one sort for all the production tables, one for the air schedule.
  const [prodSort, setProdSort] = React.useState({ k: 'startedAt', dir: 'desc' });
  const [airSort, setAirSort] = React.useState({ k: 'date', dir: 'asc' });
  React.useEffect(() => {
    api.listClients().then((r) => setClients(Array.isArray(r) ? r : (r.clients || []))).catch(() => setClients([]));
  }, []);

  const run = React.useCallback(() => {
    setLoading(true); setErr('');
    const qs = `?start=${start}&end=${end}` + (clientId ? `&clientId=${clientId}` : '');
    Promise.all([api.productionReport(qs), api.airSchedule(qs)])
      .then(([p, a]) => { setData(p); setAir(a); })
      .catch((e) => setErr(e.message || 'Could not load the report.'))
      .finally(() => setLoading(false));
  }, [start, end, clientId]);
  React.useEffect(() => { run(); /* initial load + re-run when the client changes */ }, [clientId]); // eslint-disable-line
  const clientName = clientId ? ((clients.find((c) => String(c.id) === String(clientId)) || {}).name || '') : '';

  const presetDays = (days) => { const s = new Date(); s.setDate(s.getDate() - days); setStart(iso(s)); setEnd(iso(new Date())); };
  const thisMonth = () => { const n = new Date(); setStart(iso(new Date(n.getFullYear(), n.getMonth(), 1))); setEnd(iso(n)); };
  const lastMonth = () => { const n = new Date(); setStart(iso(new Date(n.getFullYear(), n.getMonth() - 1, 1))); setEnd(iso(new Date(n.getFullYear(), n.getMonth(), 0))); };

  const inp = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '7px 9px' };
  // Headings stay at the top of the scroll box, so sorting is always in reach.
  const th = { textAlign: 'left', fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-4)', padding: '6px 10px', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2 };
  const td = { padding: '7px 10px', fontSize: 12.5, borderTop: '1px solid var(--border)', whiteSpace: 'nowrap', verticalAlign: 'top' };
  // The first column stays put while the rest scrolls sideways.
  const stick = { position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1, boxShadow: '1px 0 0 var(--border)' };
  const sortTh = (col, sort, setSort, extra) => {
    const on = sort && sort.k === col.k;
    const next = () => setSort(on ? { k: col.k, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { k: col.k, dir: 'asc' });
    return (
      <th key={col.k} style={{ ...th, ...extra, cursor: 'pointer', userSelect: 'none', color: on ? 'var(--text)' : th.color }}
        onClick={next} title={`Sort by ${col.label}`} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        {col.label}<span style={{ marginLeft: 4, opacity: on ? 1 : 0.3 }}>{on ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </th>
    );
  };

  const totals = data?.totals || { scripts: 0, casts: 0, episodes: 0, distributions: 0, total: 0 };
  const KPI = [
    { k: 'total', label: 'Total pieces', color: 'var(--text)' },
    { k: 'scripts', label: 'Scripts', color: 'var(--accent)' },
    { k: 'casts', label: 'Casts', color: 'var(--p-navy)' },
    { k: 'episodes', label: 'Episodes', color: 'var(--ok)' },
    { k: 'distributions', label: 'Distributions', color: 'var(--warn)' },
  ];

  return (
    <div className="fade-in report-root" style={{ padding: 'var(--pad)', minWidth: 0 }}>
      <style>{`@media print {
        .side, .topbar, .report-noprint { display: none !important; }
        .shell, .main, body { background: #fff !important; }
        .report-root { max-width: none !important; padding: 0 !important; }
        .report-root th, .report-root td { position: static !important; box-shadow: none !important; }
        .report-root table { min-width: 0 !important; }
        .report-scroll { max-height: none !important; overflow: visible !important; }
        .report-card { break-inside: avoid; box-shadow: none !important; }
      }`}</style>

      <div className="report-noprint">
        <div className="row" style={{ gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 6 }}>
          <div className="col" style={{ gap: 4 }}>
            <span className="label" style={{ margin: 0 }}>FROM</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inp} />
          </div>
          <div className="col" style={{ gap: 4 }}>
            <span className="label" style={{ margin: 0 }}>TO</span>
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={inp} />
          </div>
          <div className="col" style={{ gap: 4 }}>
            <span className="label" style={{ margin: 0 }}>CLIENT</span>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={{ ...inp, minWidth: 180 }}>
              <option value="">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button className="btn primary sm" onClick={run} disabled={loading}>{loading ? 'Running…' : 'Run report'}</button>
          <button className="btn sm" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className="btn sm" onClick={() => presetDays(7)}>Last 7 days</button>
          <button className="btn sm" onClick={() => presetDays(30)}>Last 30 days</button>
          <button className="btn sm" onClick={thisMonth}>This month</button>
          <button className="btn sm" onClick={lastMonth}>Last month</button>
        </div>
        <div className="row" style={{ gap: 6, marginBottom: 16 }}>
          <button className={'btn sm' + (tab === 'production' ? ' primary' : '')} onClick={() => setTab('production')}>Production</button>
          <button className={'btn sm' + (tab === 'air' ? ' primary' : '')} onClick={() => setTab('air')}>Air schedule</button>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div className="label" style={{ marginBottom: 2 }}>{tab === 'air' ? 'AIR SCHEDULE' : 'PRODUCTION REPORT'}{clientName ? ' · ' + clientName.toUpperCase() : ''}</div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtDay(start)} — {fmtDay(end)}</div>
      </div>

      {err && <div className="card card-pad" style={{ borderColor: 'var(--accent)', marginBottom: 16 }}><div className="mono" style={{ color: 'var(--accent)' }}>{err}</div></div>}

      {tab === 'air' ? (
        loading && !air ? <div className="mono">Loading…</div>
        : !air || !air.rows.length ? <div className="mono" style={{ color: 'var(--text-3)' }}>Nothing scheduled to air in this period.</div>
        : (
          <div className="card card-pad report-card">
            <div className="report-scroll" style={{ overflow: 'auto', maxHeight: '70vh' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640 }}>
                <thead><tr>
                  {AIR_COLS.filter((c) => !c.allOnly || !clientId).map((c) => sortTh(c, airSort, setAirSort))}
                </tr></thead>
                <tbody>
                  {sortRows(air.rows, airSort, (r, k) => (k === 'date' ? `${r.date || ''} ${r.time || ''}` : r[k])).map((r) => (
                    <tr key={r.kind + '-' + r.id}>
                      <td style={td}>{fmtDay(r.date)}</td>
                      <td style={td}>{fmtTime(r.time)}</td>
                      <td style={{ ...td, color: r.channel ? 'var(--text)' : 'var(--text-4)' }}>{r.channel || 'not set'}</td>
                      {!clientId && <td style={td}>{r.client_name || ('Client ' + r.client_id)}</td>}
                      <td style={{ ...td, whiteSpace: 'normal', minWidth: 220 }}>{r.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 8 }}>{air.rows.length} airing{air.rows.length === 1 ? '' : 's'}</div>
          </div>
        )
      ) : (<>

      <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 22 }}>
        {KPI.map((m) => (
          <div key={m.k} className="card card-pad report-card" style={{ flex: '1 1 130px', minWidth: 120 }}>
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 30, lineHeight: 1, color: m.color }}>{totals[m.k] ?? 0}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.04em' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {loading && !data ? <div className="mono">Loading…</div>
        : !data || !data.clients.length ? <div className="mono" style={{ color: 'var(--text-3)' }}>No production in this period.</div>
        : data.clients.map((c) => (
            // One table per client (every piece type together, sortable by any
            // column) so there's a single sideways scroll per client.
            <div key={c.clientId} className="card card-pad report-card" style={{ marginBottom: 18 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{c.clientName || ('Client ' + c.clientId)}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{c.items.length} piece{c.items.length === 1 ? '' : 's'}</span>
              </div>
              {/* Capped height so the sideways scrollbar is always on screen. */}
              <div className="report-scroll" style={{ overflow: 'auto', maxHeight: '70vh' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 1180 }}>
                  <thead><tr>
                    {PROD_COLS.map((col) => sortTh(col, prodSort, setProdSort, col.k === 'title' ? { ...stick, top: 0, zIndex: 3, minWidth: 260 } : null))}
                  </tr></thead>
                  <tbody>
                    {sortRows(c.items, prodSort, (r, k) => (k === 'kind' ? (KIND_LABEL[r.kind] || r.kind) : r[k])).map((it) => (
                      <tr key={it.kind + '-' + it.id}>
                        <td style={{ ...td, ...stick, whiteSpace: 'normal', minWidth: 260, maxWidth: 380 }}>{it.title}</td>
                        <td style={{ ...td, textTransform: 'capitalize' }}>{it.pieceType || '—'}</td>
                        <td style={td}>{KIND_LABEL[it.kind] || it.kind}</td>
                        <td style={td}>{it.jobNumber || '—'}</td>
                        <td style={td}>{fmt(it.startedAt)}</td>
                        <td style={td}>{fmt(it.sentAt)}</td>
                        <td style={td}>{fmt(it.approvedAt)}</td>
                        <td style={td}>{fmt(it.changesAt)}</td>
                        <td style={td}>{fmt(it.finishedAt)}</td>
                        <td style={{ ...td, whiteSpace: 'normal', minWidth: 160, color: it.finishedAt ? 'var(--ok)' : 'var(--text-3)' }}>{it.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
      </>)}
    </div>
  );
}
