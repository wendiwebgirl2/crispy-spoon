import React, { useState, useEffect } from 'react'
import { Icon } from './shared.jsx'
import { sched } from './dashboard-api.js'

const CHAN_COLORS = { podcast: '#fbb033', instagram: '#d6608f', linkedin: '#4a90d6', x: '#6bbf8a', default: '#b09a8d' };
const colorOf = (k) => CHAN_COLORS[k] || CHAN_COLORS.default;

const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px', boxSizing: 'border-box', width: '100%' };

function PlanCard({ item, onAdvance, onDel }) {
  const next = { draft: 'scheduled', scheduled: 'delivered' }[item.status];
  const nextLabel = { scheduled: 'Schedule', delivered: 'Mark delivered' }[next];
  return (
    <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}><span className="badge">{item.channel}</span> <span style={{ fontWeight: 600, fontSize: 13 }}>{item.title || '(untitled)'}</span></div>
        <button className="btn sm" onClick={() => onDel(item.id)}>✕</button>
      </div>
      {item.channel_name && <div className="mono" style={{ color: 'var(--text-4)', marginTop: 4 }}>↳ {item.channel_name}</div>}
      <div className="mono" style={{ color: 'var(--text-4)', marginTop: 2 }}>{item.scheduled_for ? '🗓 ' + item.scheduled_for : 'no date set'}</div>
      {item.script_body && <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, maxHeight: 70, overflow: 'hidden' }}>{item.script_body.slice(0, 160)}…</div>}
      {next ? <button className="btn sm primary" style={{ marginTop: 8 }} onClick={() => onAdvance(item.id, next)}>{nextLabel}</button>
            : <span className="badge" style={{ color: 'var(--ok)', marginTop: 8, display: 'inline-block' }}>✓ delivered</span>}
    </div>
  );
}

function Timeline({ items, channels, weekOffset }) {
  const DAYS = 14;
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + weekOffset * DAYS);
  const days = Array.from({ length: DAYS }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const todayKey = new Date().toDateString();
  const lanes = channels.map((c) => c.key);
  const cols = `160px repeat(${DAYS}, 1fr)`;
  const chanLabel = (k) => (channels.find((c) => c.key === k) || {}).label || k;

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, minWidth: 760 }}>
        <div />
        {days.map((d, i) => (
          <div key={i} style={{ borderLeft: '1px solid var(--border)', padding: '6px 0', textAlign: 'center', fontSize: 11, color: 'var(--text-4)', background: d.toDateString() === todayKey ? 'rgba(251,176,51,0.12)' : 'transparent' }}>
            {d.toLocaleDateString(undefined, { weekday: 'short' })}<br />{d.getDate()}/{d.getMonth() + 1}
          </div>
        ))}
        {lanes.map((ch) => (
          <React.Fragment key={ch}>
            <div style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 600, borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 7, whiteSpace: 'nowrap' }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: colorOf(ch), flex: 'none' }} />{chanLabel(ch)}
            </div>
            {days.map((d, i) => {
              const hit = items.find((it) => it.channel === ch && it.scheduled_for && new Date(String(it.scheduled_for).replace(' ', 'T')).toDateString() === d.toDateString());
              return (
                <div key={i} style={{ borderTop: '1px solid var(--border)', borderLeft: '1px solid var(--border)', position: 'relative', minHeight: 38 }}>
                  {hit && <div title={(hit.title || '') + ' — ' + hit.status} style={{ position: 'absolute', top: 5, left: 3, right: 3, bottom: 5, borderRadius: 6, fontSize: 11, color: '#15120e', padding: '3px 6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: 600, background: colorOf(ch), opacity: hit.status === 'draft' ? 0.42 : 1, outline: hit.status === 'delivered' ? '2px solid #fff' : 'none', outlineOffset: -2 }}>{hit.title || '•'}</div>}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

const PlannerView = ({ activeClientId }) => {
  const cid = activeClientId;
  const [items, setItems] = useState([]);
  const [channels, setChannels] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);
  const [channel, setChannel] = useState('');
  const [channelName, setChannelName] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [scriptId, setScriptId] = useState('');

  const load = () => {
    if (cid == null) { setLoading(false); return; }
    setLoading(true); setErr('');
    Promise.all([
      sched.list(cid).catch(() => []),
      sched.channels().catch(() => []),
      sched.approvedScripts(cid).catch(() => []),
    ]).then(([it, ch, sc]) => {
      setItems(Array.isArray(it) ? it : (it.items || []));
      const chans = Array.isArray(ch) ? ch : [];
      setChannels(chans);
      setChannel((prev) => prev || (chans[0] ? chans[0].key : ''));
      const scr = Array.isArray(sc) ? sc : (sc.scripts || []);
      setApproved(scr.filter((s) => s.status === 'approved'));
    }).catch((e) => setErr(e.message || 'Could not load planner.')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [cid]);

  const add = async () => {
    if (!channel) { setErr('Pick a channel'); return; }
    const body = { channel, title };
    if (channelName) body.channelName = channelName;
    if (date) body.scheduledFor = `${date} ${time || '09:00'}`;
    if (scriptId) body.scriptId = Number(scriptId);
    try { await sched.add(cid, body); setTitle(''); setChannelName(''); setDate(''); setScriptId(''); load(); }
    catch (e) { setErr(e.message); }
  };
  const advance = async (id, status) => { try { await sched.advance(cid, id, status); load(); } catch (e) { setErr(e.message); } };
  const del = async (id) => { if (!window.confirm('Remove from planner?')) return; try { await sched.del(cid, id); load(); } catch (e) { setErr(e.message); } };

  if (cid == null) {
    return (
      <div className="v-pad">
        <div className="card card-pad" style={{ borderStyle: 'dashed' }}>
          <div className="label" style={{ marginBottom: 6 }}>PLANNER</div>
          <div className="mono" style={{ color: 'var(--text-3)' }}>Select a client first — the planner is per client.</div>
        </div>
      </div>
    );
  }

  const byStatus = (st) => items.filter((i) => i.status === st);

  return (
    <div className="v-pad fade-in">
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 10 }}>PLAN A POST</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="col" style={{ gap: 4 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Channel</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} style={inputStyle}>{channels.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
          <label className="col" style={{ gap: 4 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Channel name</span>
            <input value={channelName} onChange={(e) => setChannelName(e.target.value)} placeholder="e.g. The Morning Brew Show" style={inputStyle} /></label>
          <label className="col" style={{ gap: 4 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode / post name" style={inputStyle} /></label>
          <div className="row" style={{ gap: 8 }}>
            <label className="col" style={{ gap: 4, flex: 1 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Date</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></label>
            <label className="col" style={{ gap: 4, width: 120 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Time</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} /></label>
          </div>
        </div>
        <label className="col" style={{ gap: 4, marginTop: 10 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Attach approved script (optional)</span>
          <select value={scriptId} onChange={(e) => setScriptId(e.target.value)} style={inputStyle}>
            <option value="">— none —</option>
            {approved.map((s) => <option key={s.id} value={s.id}>{s.channel}: {(s.topic || s.body || '').slice(0, 40)}</option>)}
          </select></label>
        <button className="btn primary" onClick={add} style={{ marginTop: 10 }}><Icon name="plus" size={13} /> Add to planner</button>
        {approved.length === 0 && <div className="mono" style={{ color: 'var(--text-4)', marginTop: 8 }}>Tip: approve scripts in the Scripts tab to attach them here.</div>}
      </div>

      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      {loading && <div className="mono" style={{ color: 'var(--text-3)' }}>Loading planner…</div>}

      <div className="row" style={{ gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
        {[['draft', 'Draft'], ['scheduled', 'Scheduled'], ['delivered', 'Delivered']].map(([st, lbl]) => (
          <div key={st} className="card card-pad" style={{ flex: 1, minWidth: 0 }}>
            <div className="label" style={{ marginBottom: 10 }}>{lbl} <span style={{ color: 'var(--text-4)' }}>({byStatus(st).length})</span></div>
            <div className="col" style={{ gap: 8 }}>
              {byStatus(st).length === 0 ? <div className="mono" style={{ color: 'var(--text-4)' }}>Nothing here.</div>
                : byStatus(st).map((i) => <PlanCard key={i.id} item={i} onAdvance={advance} onDel={del} />)}
            </div>
          </div>
        ))}
      </div>

      <div className="card card-pad">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="label">TIMELINE</div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={() => setWeekOffset(weekOffset - 1)}>‹ Earlier</button>
            <button className="btn sm" onClick={() => setWeekOffset(0)}>Today</button>
            <button className="btn sm" onClick={() => setWeekOffset(weekOffset + 1)}>Later ›</button>
          </div>
        </div>
        <Timeline items={items} channels={channels} weekOffset={weekOffset} />
      </div>
    </div>
  );
};

export { PlannerView };
