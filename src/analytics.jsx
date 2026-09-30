import React, { useState, useEffect } from 'react'
import { Icon } from './shared.jsx'
import { api } from './api.js'

// Staff Analytics — how a client's Planner posts are doing on YouTube/Facebook.
// The date range drives the numbers AND the PDF overview (download or email to
// the client). Data: voicecast lib/analytics.js (daily snapshots per post).

const inputStyle = {
  background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px',
  boxSizing: 'border-box', height: 38,
};
const PLABEL = { youtube: 'YouTube', facebook: 'Facebook' };
const PCOLOR = { youtube: '#e0343a', facebook: '#4a90d6' };
const fmtN = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString());
const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(String(v).slice(0, 10) + 'T00:00:00');
  return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
const iso = (d) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); };

function presets() {
  const now = new Date();
  const days = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return d; };
  const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endLast = new Date(now.getFullYear(), now.getMonth(), 0);
  return [
    { k: '30', label: 'Last 30 days', from: iso(days(29)), to: iso(now) },
    { k: '90', label: 'Last 90 days', from: iso(days(89)), to: iso(now) },
    { k: 'this', label: 'This month', from: iso(firstThis), to: iso(now) },
    { k: 'last', label: 'Last month', from: iso(firstLast), to: iso(endLast) },
  ];
}

function Tile({ label, value, sub }) {
  return (
    <div className="card card-pad" style={{ flex: '1 1 150px', minWidth: 140 }}>
      <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, lineHeight: 1.1 }}>{value}</div>
      <div className="label" style={{ marginTop: 6 }}>{label}</div>
      {sub && <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// Daily total views across the client's posts (last 90 days), as bars.
function Trend({ series }) {
  if (!series || series.length < 2) {
    return <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>The trend fills in as daily numbers are collected.</div>;
  }
  const max = Math.max(...series.map((s) => Number(s.views) || 0), 1);
  const W = 100 / series.length;
  return (
    <div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" style={{ width: '100%', height: 120, display: 'block' }} role="img" aria-label="Total views per day">
        {series.map((s, i) => {
          const h = ((Number(s.views) || 0) / max) * 38;
          return <rect key={s.date} x={i * W + W * 0.15} y={40 - h} width={W * 0.7} height={h} fill="var(--accent-2, #fbb033)"><title>{`${fmtDate(s.date)}: ${fmtN(s.views)} views`}</title></rect>;
        })}
      </svg>
      <div className="row mono" style={{ justifyContent: 'space-between', fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
        <span>{fmtDate(series[0].date)}</span><span>peak {fmtN(max)} total views</span><span>{fmtDate(series[series.length - 1].date)}</span>
      </div>
    </div>
  );
}

const AnalyticsView = ({ activeClientId, onSelectClient }) => {
  const cid = activeClientId;
  const P = presets();
  const [clientList, setClientList] = useState([]);
  const [range, setRange] = useState({ from: P[0].from, to: P[0].to });
  const [data, setData] = useState(null);
  const [overall, setOverall] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailNote, setEmailNote] = useState('');

  useEffect(() => { api.listClients().then((cs) => setClientList(Array.isArray(cs) ? cs : (cs.clients || []))).catch(() => setClientList([])); }, []);

  const load = () => {
    if (cid == null) return;
    setLoading(true); setErr('');
    Promise.all([api.analyticsRange(cid, range.from, range.to), api.analytics(cid)])
      .then(([r, o]) => { setData(r); setOverall(o); })
      .catch((e) => setErr(e.message || 'Could not load analytics.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [cid, range.from, range.to]);

  const refresh = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = await api.refreshAnalytics(cid);
      const errs = (r.collected && r.collected.errors) || [];
      setMsg(r.busy ? 'A refresh is already running — try again in a minute.' : errs.length ? `Refreshed with warnings: ${errs.join('; ')}` : 'Numbers refreshed.');
      load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  const sendEmail = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = await api.emailAnalyticsReport(cid, { from: range.from, to: range.to, email: emailTo.trim() || undefined, note: emailNote.trim() || undefined });
      setMsg(`Overview emailed to ${r.sent_to}.`); setEmailOpen(false); setEmailNote('');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const clientPicker = (
    <select value={cid || ''} onChange={(e) => { const id = Number(e.target.value); if (id && onSelectClient) onSelectClient(id); }} style={{ ...inputStyle, minWidth: 220 }}>
      <option value="">Pick a client…</option>
      {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  );

  if (cid == null) {
    return (
      <div className="v-pad">
        <div className="card card-pad" style={{ borderStyle: 'dashed' }}>
          <div className="label" style={{ marginBottom: 6 }}>ANALYTICS</div>
          <div className="mono" style={{ color: 'var(--text-3)', marginBottom: 10 }}>Analytics are per client — pick one.</div>
          {clientPicker}
        </div>
      </div>
    );
  }

  const clientName = (clientList.find((c) => c.id === cid) || {}).name || '';
  const t = data && data.totals;
  const notes = overall && overall.notes ? Object.values(overall.notes).filter(Boolean) : [];

  return (
    <div className="v-pad fade-in">
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 26, letterSpacing: '-0.01em', margin: '0 0 4px' }}>
        <em style={{ color: 'var(--accent)' }}>Analytics</em>{clientName ? ` — ${clientName}` : ''}
      </h1>
      <div className="mono" style={{ color: 'var(--text-4)', marginBottom: 16 }}>
        YouTube + Facebook posts published from the Planner. Numbers are for posts published in the range, as of the end date.
        {overall && overall.lastUpdated ? ` Last updated ${fmtDate(overall.lastUpdated)}.` : ''}
      </div>

      {/* controls */}
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {clientPicker}
          <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} style={inputStyle} aria-label="From" />
          <span className="mono" style={{ color: 'var(--text-4)' }}>to</span>
          <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} style={inputStyle} aria-label="To" />
          {P.map((p) => (
            <button key={p.k} className="btn sm" onClick={() => setRange({ from: p.from, to: p.to })}
              style={{ borderColor: range.from === p.from && range.to === p.to ? 'var(--accent)' : undefined }}>{p.label}</button>
          ))}
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <a className="btn primary sm" href={api.analyticsReportUrl(cid, range.from, range.to)}><Icon name="download" size={12} /> Download PDF</a>
          <button className="btn sm" onClick={() => setEmailOpen((v) => !v)}><Icon name="send" size={12} /> Email PDF to client</button>
          <button className="btn sm" disabled={busy} onClick={refresh} style={{ opacity: busy ? 0.6 : 1 }}><Icon name="history" size={12} /> {busy ? 'Working…' : 'Refresh numbers'}</button>
        </div>
        {emailOpen && (
          <div className="col" style={{ gap: 8, marginTop: 12, maxWidth: 520 }}>
            <input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="Client email (leave blank to use the Brief email)" style={{ ...inputStyle, width: '100%' }} />
            <textarea className="textarea" value={emailNote} onChange={(e) => setEmailNote(e.target.value)} placeholder="Optional note to include in the email" style={{ minHeight: 70, fontSize: 13 }} />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn primary sm" disabled={busy} onClick={sendEmail}><Icon name="send" size={12} /> Send overview ({fmtDate(range.from)} – {fmtDate(range.to)})</button>
              <button className="btn sm" onClick={() => setEmailOpen(false)}>Cancel</button>
            </div>
          </div>
        )}
        {msg && <div className="mono" style={{ marginTop: 10, fontSize: 12, color: 'var(--ok)' }}>{msg}</div>}
        {err && <div className="mono" style={{ marginTop: 10, fontSize: 12, color: 'var(--warn)' }}>{err}</div>}
        {notes.map((n) => <div key={n} className="mono" style={{ marginTop: 6, fontSize: 11, color: 'var(--text-4)' }}>{n}</div>)}
      </div>

      {loading && !data && <div className="mono">Loading…</div>}

      {t && (
        <>
          <div className="row" style={{ gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <Tile label="Posts published" value={fmtN(t.posts)} sub={t.posts ? `${fmtN(t.measured)} with numbers` : null} />
            <Tile label="Views" value={fmtN(t.views)} sub={data.gained ? `${fmtN(data.gained.views)} new views in period (all posts)` : null} />
            <Tile label="Likes" value={fmtN(t.likes)} />
            <Tile label="Comments" value={fmtN(t.comments)} />
          </div>

          <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'stretch', marginBottom: 16 }}>
            <div className="card card-pad" style={{ flex: '1 1 280px' }}>
              <div className="label" style={{ marginBottom: 10 }}>BY PLATFORM</div>
              {data.byPlatform.filter((p) => p.posts).map((p) => (
                <div key={p.platform} className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: PCOLOR[p.platform], flex: 'none' }} />
                  <strong style={{ minWidth: 80, fontSize: 13 }}>{PLABEL[p.platform] || p.platform}</strong>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {fmtN(p.posts)} posts · {p.measured ? `${fmtN(p.views)} views · ${fmtN(p.likes)} likes · ${fmtN(p.comments)} comments` : 'numbers coming soon'}
                  </span>
                </div>
              ))}
              {!t.posts && <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>No posts published in this range.</div>}
            </div>
            <div className="card card-pad" style={{ flex: '2 1 380px' }}>
              <div className="label" style={{ marginBottom: 10 }}>TOTAL VIEWS · LAST 90 DAYS</div>
              <Trend series={overall && overall.series} />
            </div>
          </div>

          {data.episodes.length > 0 && (
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <div className="label" style={{ marginBottom: 10 }}>BY EPISODE <span style={{ color: 'var(--text-4)' }}>· longform + its shortforms</span></div>
              {data.episodes.map((e, i) => (
                <div key={i} className="row" style={{ justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 13 }}>{e.topic}</span>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmtN(e.posts)} posts · {fmtN(e.views)} views · {fmtN(e.likes)} likes</span>
                </div>
              ))}
            </div>
          )}

          {data.posts.length > 0 && (
            <div className="card card-pad" style={{ overflowX: 'auto' }}>
              <div className="label" style={{ marginBottom: 10 }}>POSTS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr className="mono" style={{ fontSize: 11, color: 'var(--text-4)', textAlign: 'left' }}>
                    <th style={{ padding: '4px 8px 8px 0' }}>Date</th><th style={{ padding: '4px 8px 8px' }}>Platform</th><th style={{ padding: '4px 8px 8px' }}>Title</th>
                    <th style={{ padding: '4px 8px 8px', textAlign: 'right' }}>Views</th><th style={{ padding: '4px 8px 8px', textAlign: 'right' }}>Likes</th><th style={{ padding: '4px 0 8px 8px', textAlign: 'right' }}>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {data.posts.map((p) => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="mono" style={{ padding: '7px 8px 7px 0', whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(p.published_at)}</td>
                      <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: PCOLOR[p.platform], marginRight: 6 }} />{PLABEL[p.platform] || p.platform}</td>
                      <td style={{ padding: '7px 8px' }}>{p.url ? <a href={p.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text)' }}>{p.title || p.topic || 'Untitled'}</a> : (p.title || p.topic || 'Untitled')}</td>
                      <td className="mono" style={{ padding: '7px 8px', textAlign: 'right' }}>{fmtN(p.views)}</td>
                      <td className="mono" style={{ padding: '7px 8px', textAlign: 'right' }}>{fmtN(p.likes)}</td>
                      <td className="mono" style={{ padding: '7px 0 7px 8px', textAlign: 'right' }}>{fmtN(p.comments)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export { AnalyticsView }
