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

const KIND_LABEL = { script: 'Script', cast: 'Cast', episode: 'Episode', distribution: 'Distribution' };

export function ProductionReportView() {
  const now = new Date();
  const monthAgo = new Date(); monthAgo.setDate(monthAgo.getDate() - 30);
  const [start, setStart] = React.useState(iso(monthAgo));
  const [end, setEnd] = React.useState(iso(now));
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const run = React.useCallback(() => {
    setLoading(true); setErr('');
    api.productionReport(`?start=${start}&end=${end}`)
      .then(setData).catch((e) => setErr(e.message || 'Could not load the report.'))
      .finally(() => setLoading(false));
  }, [start, end]);
  React.useEffect(() => { run(); /* initial load */ }, []); // eslint-disable-line

  const presetDays = (days) => { const s = new Date(); s.setDate(s.getDate() - days); setStart(iso(s)); setEnd(iso(new Date())); };
  const thisMonth = () => { const n = new Date(); setStart(iso(new Date(n.getFullYear(), n.getMonth(), 1))); setEnd(iso(n)); };
  const lastMonth = () => { const n = new Date(); setStart(iso(new Date(n.getFullYear(), n.getMonth() - 1, 1))); setEnd(iso(new Date(n.getFullYear(), n.getMonth(), 0))); };

  const inp = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '7px 9px' };
  const th = { textAlign: 'left', fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-4)', padding: '6px 10px', whiteSpace: 'nowrap' };
  const td = { padding: '7px 10px', fontSize: 12.5, borderTop: '1px solid var(--border)', whiteSpace: 'nowrap' };

  const totals = data?.totals || { scripts: 0, casts: 0, episodes: 0, distributions: 0, total: 0 };
  const KPI = [
    { k: 'total', label: 'Total pieces', color: 'var(--text)' },
    { k: 'scripts', label: 'Scripts', color: 'var(--accent)' },
    { k: 'casts', label: 'Casts', color: 'var(--p-navy)' },
    { k: 'episodes', label: 'Episodes', color: 'var(--ok)' },
    { k: 'distributions', label: 'Distributions', color: 'var(--warn)' },
  ];

  return (
    <div className="fade-in report-root" style={{ padding: 'var(--pad)', maxWidth: 1080 }}>
      <style>{`@media print {
        .side, .topbar, .report-noprint { display: none !important; }
        .shell, .main, body { background: #fff !important; }
        .report-root { max-width: none !important; padding: 0 !important; }
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
          <button className="btn primary sm" onClick={run} disabled={loading}>{loading ? 'Running…' : 'Run report'}</button>
          <button className="btn sm" onClick={() => window.print()}>Print / Save PDF</button>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button className="btn sm" onClick={() => presetDays(7)}>Last 7 days</button>
          <button className="btn sm" onClick={() => presetDays(30)}>Last 30 days</button>
          <button className="btn sm" onClick={thisMonth}>This month</button>
          <button className="btn sm" onClick={lastMonth}>Last month</button>
        </div>
      </div>

      <div style={{ marginBottom: 18 }}>
        <div className="label" style={{ marginBottom: 2 }}>PRODUCTION REPORT</div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmt(start + ' 00:00:00').replace(/,.*$/, '')} — {fmt(end + ' 00:00:00').replace(/,.*$/, '')}</div>
      </div>

      {err && <div className="card card-pad" style={{ borderColor: 'var(--accent)', marginBottom: 16 }}><div className="mono" style={{ color: 'var(--accent)' }}>{err}</div></div>}

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
        : data.clients.map((c) => {
          const groups = {};
          for (const it of c.items) (groups[it.pieceType] = groups[it.pieceType] || []).push(it);
          const types = Object.keys(groups).sort();
          return (
            <div key={c.clientId} className="card card-pad report-card" style={{ marginBottom: 18 }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: 16 }}>{c.clientName || ('Client ' + c.clientId)}</span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>{c.items.length} piece{c.items.length === 1 ? '' : 's'}</span>
              </div>
              {types.map((ty) => (
                <div key={ty} style={{ marginBottom: 14 }}>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em', margin: '4px 0 6px' }}>{ty} · {groups[ty].length}</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
                      <thead><tr>
                        <th style={th}>Piece</th><th style={th}>Type</th><th style={th}>Job #</th>
                        <th style={th}>Started</th><th style={th}>Sent</th><th style={th}>Approved</th>
                        <th style={th}>Changes</th><th style={th}>Completed</th><th style={th}>Status</th>
                      </tr></thead>
                      <tbody>
                        {groups[ty].map((it) => (
                          <tr key={it.kind + '-' + it.id}>
                            <td style={{ ...td, whiteSpace: 'normal', minWidth: 200 }}>{it.title}</td>
                            <td style={td}>{KIND_LABEL[it.kind] || it.kind}</td>
                            <td style={td}>{it.jobNumber || '—'}</td>
                            <td style={td}>{fmt(it.startedAt)}</td>
                            <td style={td}>{fmt(it.sentAt)}</td>
                            <td style={td}>{fmt(it.approvedAt)}</td>
                            <td style={td}>{fmt(it.changesAt)}</td>
                            <td style={td}>{fmt(it.finishedAt)}</td>
                            <td style={{ ...td, color: it.finishedAt ? 'var(--ok)' : 'var(--text-3)' }}>{it.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
    </div>
  );
}
