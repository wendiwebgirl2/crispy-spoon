import React, { useState, useEffect } from 'react'
import { Icon } from './shared.jsx'
import { episodeLog } from './dashboard-api.js'
import { api } from './api.js'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const FORMAT_COLORS = { Longform: '#fbb033', Shortform: '#d6608f', Blog: '#4a90d6', 'TV/Radio': '#6bbf8a' };
const colorOf = (format) => FORMAT_COLORS[format] || '#b09a8d';

const inputStyle = {
  background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px',
  boxSizing: 'border-box', height: 38,
};

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(String(v).slice(0, 10) + 'T00:00:00');
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

// A row of small dots, one per ladder rung — done (accent-2), overdue (warn),
// not-applicable (very faint), upcoming (outline only).
function RungDots({ ladder }) {
  return (
    <div className="row" style={{ gap: 4 }} title={ladder.map((r) => `${r.label}: ${r.applicable === false ? 'n/a' : r.done ? 'done' : r.overdue ? 'overdue' : `due ${r.due || '—'}`}`).join('\n')}>
      {ladder.map((r) => (
        <span key={r.key} style={{
          width: 9, height: 9, borderRadius: '50%', flex: 'none',
          background: r.applicable === false ? 'transparent' : r.done ? 'var(--ok)' : r.overdue ? 'var(--warn)' : 'transparent',
          border: r.applicable === false ? '1px dashed var(--border)' : `1.5px solid ${r.done ? 'var(--ok)' : r.overdue ? 'var(--warn)' : 'var(--border)'}`,
        }} />
      ))}
    </div>
  );
}

function AiringRow({ a }) {
  return (
    <div className="row" style={{
      alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 'var(--r-sm)',
      background: a.overdue ? 'rgba(224,52,52,0.06)' : 'var(--surface-2)', border: '1px solid ' + (a.overdue ? 'var(--warn)' : 'var(--border)'),
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorOf(a.format), flex: 'none' }} />
      <div style={{ minWidth: 84, fontSize: 12, fontWeight: 700 }}>{a.format}</div>
      <div className="mono" style={{ minWidth: 130, fontSize: 12, color: 'var(--text-3)' }}>{a.channelName}</div>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title || '(untitled)'}</div>
      <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', minWidth: 90 }}>{fmtDate(a.airDate)}</div>
      <RungDots ladder={a.ladder} />
      <div className="mono" style={{ fontSize: 11, minWidth: 150, textAlign: 'right', color: a.overdue ? 'var(--warn)' : 'var(--text-4)' }}>
        {a.currentRung ? `${a.overdue ? 'Overdue: ' : 'Next: '}${a.currentRung.label}${a.currentRung.due ? ` (${fmtDate(a.currentRung.due)})` : ''}` : 'All done'}
      </div>
    </div>
  );
}

function CadenceCard({ client, onSaved }) {
  const [startDate, setStartDate] = useState(client.startDate || '');
  const [blogDay, setBlogDay] = useState(client.blogDay || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setStartDate(client.startDate || ''); setBlogDay(client.blogDay || ''); }, [client.id, client.startDate, client.blogDay]);
  const dirty = startDate !== (client.startDate || '') || blogDay !== (client.blogDay || '');
  const save = async () => {
    setBusy(true); setErr('');
    try { await api.updateClientCadence(client.id, { startDate: startDate || null, blogDay: blogDay || null }); onSaved(); }
    catch (e) { setErr(e.message || 'Could not save.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <div className="label" style={{ marginBottom: 10 }}>CADENCE</div>
      <div className="row" style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>Start date (week 1)</div>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 4 }}>Blog day</div>
          <select value={blogDay} onChange={(e) => setBlogDay(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
            <option value="">—</option>
            {WEEKDAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {dirty && <button className="btn sm primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>}
      </div>
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 8 }}>
        LF airs everywhere on D0 (the week's start date + 7×(week−1)); SF1/2/3 post D+1/+2/+3; the blog is written and emailed to the client on the fixed weekday above, same week.
      </div>
      {err && <div className="mono" style={{ color: 'var(--warn)', fontSize: 12, marginTop: 8 }}>{err}</div>}
    </div>
  );
}

function LadderEditor({ ladder, cid, onSaved }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(ladder);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { setRows(ladder); }, [ladder]);
  const setRow = (i, field, value) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const save = async () => {
    setBusy(true); setErr('');
    try { await episodeLog.putLadder(cid, rows.map((r) => ({ key: r.key, label: r.label, offsetDays: Number(r.offsetDays) }))); setOpen(false); onSaved(); }
    catch (e) { setErr(e.message || 'Could not save.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="card card-pad" style={{ marginBottom: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="label">DEADLINE LADDER <span style={{ color: 'var(--text-4)' }}>(shared default — applies to every client)</span></div>
        <button className="btn sm" onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'Edit'}</button>
      </div>
      {!open ? (
        <div className="row" style={{ gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
          {ladder.map((r) => (
            <div key={r.key} className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{r.label} <span style={{ color: 'var(--text-4)' }}>D{r.offsetDays}</span></div>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => (
            <div key={r.key} className="row" style={{ gap: 10, alignItems: 'center' }}>
              <input value={r.label} onChange={(e) => setRow(i, 'label', e.target.value)} style={{ ...inputStyle, flex: 1 }} />
              <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>D</span>
              <input type="number" value={r.offsetDays} onChange={(e) => setRow(i, 'offsetDays', e.target.value)} style={{ ...inputStyle, width: 70 }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)', width: 90 }}>{r.key}</span>
            </div>
          ))}
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>Offsets count back from an airing's air date (negative = days before). Rungs can be relabeled and retimed but not added/removed here.</div>
          {err && <div className="mono" style={{ color: 'var(--warn)', fontSize: 12 }}>{err}</div>}
          <div><button className="btn sm primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save ladder'}</button></div>
        </div>
      )}
    </div>
  );
}

const EpisodeLogView = ({ activeClientId, onSelectClient, onBackToStudio }) => {
  const cid = activeClientId;
  const [clientList, setClientList] = useState([]);
  useEffect(() => { if (cid == null) api.listClients().then((cs) => setClientList(Array.isArray(cs) ? cs : (cs.clients || []))).catch(() => setClientList([])); }, [cid]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = () => {
    if (cid == null) { setLoading(false); return; }
    setLoading(true); setErr('');
    episodeLog.get(cid).then(setData).catch((e) => setErr(e.message || 'Could not load the episode log.')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [cid]);

  if (cid == null) {
    return (
      <div className="v-pad">
        {onBackToStudio && <button className="btn sm" style={{ marginBottom: 10 }} onClick={onBackToStudio}><Icon name="arrow-l" size={12} /> Studio</button>}
        <div className="card card-pad" style={{ borderStyle: 'dashed' }}>
          <div className="label" style={{ marginBottom: 6 }}>EPISODE LOG</div>
          <div className="mono" style={{ color: 'var(--text-3)', marginBottom: 10 }}>The Episode Log is per client — pick one.</div>
          <select value="" onChange={(e) => { const id = Number(e.target.value); if (id && onSelectClient) onSelectClient(id); }}
            style={{ ...inputStyle, minWidth: 240 }}>
            <option value="">Pick a client…</option>
            {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className="v-pad fade-in">
      {onBackToStudio && <button className="btn sm" style={{ marginBottom: 10 }} onClick={onBackToStudio}><Icon name="arrow-l" size={12} /> Studio</button>}
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 26, letterSpacing: '-0.01em', margin: '0 0 4px' }}>
        <em style={{ color: 'var(--accent)' }}>Episode Log</em>{data?.client?.name ? ` — ${data.client.name}` : ''}
      </h1>
      <div className="mono" style={{ color: 'var(--text-4)', marginBottom: 16 }}>Week, episode, air date, channel, and format for every airing, sourced from the planner — with each one's deadline-ladder status.</div>

      {loading && <div className="mono">Loading…</div>}
      {err && <div className="mono" style={{ color: 'var(--warn)' }}>{err}</div>}

      {data && (
        <>
          <CadenceCard client={data.client} onSaved={load} />
          <LadderEditor ladder={data.ladder} cid={cid} onSaved={load} />

          {data.weeks.length === 0 ? (
            <div className="mono" style={{ color: 'var(--text-3)' }}>Nothing on the planner yet for this client.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {data.weeks.map((w) => (
                <div key={w.weekNumber ?? 'unscheduled'}>
                  <div className="row" style={{ alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                    <div style={{ fontFamily: 'var(--f-display)', fontSize: 17 }}>
                      {w.weekNumber != null ? `Week ${w.weekNumber}` : 'Unscheduled / before start date'}
                    </div>
                    {w.episodeTitle && <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>· {w.episodeTitle}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {w.airings.map((a) => <AiringRow key={a.id} a={a} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export { EpisodeLogView }
