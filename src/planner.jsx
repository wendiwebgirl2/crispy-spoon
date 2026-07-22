import React, { useState, useEffect } from 'react'
import { Icon } from './shared.jsx'
import { sched } from './dashboard-api.js'

const CHAN_COLORS = {
  longform: '#fbb033', shortform: '#d6608f', blog: '#4a90d6', episode: '#6bbf8a',
  podcast: '#fbb033', instagram: '#d6608f', linkedin: '#4a90d6', x: '#6bbf8a',
  default: '#b09a8d',
};
const EXTRA_COLORS = ['#c96f4a', '#8a7ad6', '#4ab8a8', '#d6c04a'];
const colorFallback = (k) => EXTRA_COLORS[String(k).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % EXTRA_COLORS.length];
const colorOf = (k) => CHAN_COLORS[k] || colorFallback(k);

const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px', boxSizing: 'border-box', width: '100%' };

function PlanCard({ item, onAdvance, onDel, onSchedule }) {
  const next = { draft: 'scheduled', scheduled: 'delivered' }[item.status];
  return (
    <div className="card card-pad" style={{ background: 'var(--surface-2)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ minWidth: 0 }}><span className="badge">{item.channel}</span> <span style={{ fontWeight: 600, fontSize: 13 }}>{item.title || '(untitled)'}</span></div>
        <button className="btn sm" onClick={() => onDel(item.id)}>✕</button>
      </div>
      {item.channel_name && <div className="mono" style={{ color: 'var(--text-4)', marginTop: 4 }}>↳ {item.channel_name}</div>}
      <div className="mono" style={{ color: 'var(--text-4)', marginTop: 2 }}>{item.scheduled_for ? '🗓 ' + item.scheduled_for : 'no date set'}</div>
      {item.script_body && <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6, maxHeight: 70, overflow: 'hidden' }}>{item.script_body.slice(0, 160)}…</div>}
      {item.status === 'draft' && <button className="btn sm primary" style={{ marginTop: 8 }} onClick={() => onSchedule(item)}><Icon name="history" size={12} /> Schedule</button>}
      {item.status === 'scheduled' && (
        <div className="row" style={{ gap: 6, marginTop: 8 }}>
          <button className="btn sm" onClick={() => onSchedule(item)}>Reschedule</button>
          <button className="btn sm primary" onClick={() => onAdvance(item.id, 'delivered')}>Mark delivered</button>
        </div>
      )}
      {item.status === 'delivered' && <span className="badge" style={{ color: 'var(--ok)', marginTop: 8, display: 'inline-block' }}>✓ delivered</span>}
    </div>
  );
}

function Timeline({ items, channels, weekOffset, onEventClick }) {
  const DAYS = 14;
  const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + weekOffset * DAYS);
  const days = Array.from({ length: DAYS }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const todayKey = new Date().toDateString();
  const lanes = [...new Set([...channels.map((c) => c.key), ...items.map((i) => i.channel).filter(Boolean)])];
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
                  {hit && <div title={(hit.title || '') + ' — ' + hit.status} onClick={() => onEventClick && onEventClick(hit)} style={{ cursor: 'pointer', position: 'absolute', top: 5, left: 3, right: 3, bottom: 5, borderRadius: 6, fontSize: 11, color: '#15120e', padding: '3px 6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: 600, background: colorOf(ch), opacity: hit.status === 'draft' ? 0.42 : 1, outline: hit.status === 'delivered' ? '2px solid #fff' : 'none', outlineOffset: -2 }}>{hit.title || '•'}</div>}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

const PlannerView = ({ activeClientId, onCastScript, onBackToStudio }) => {
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
  const [preview, setPreview] = useState(null);       // script preview from Ready to Distribute
  const [schedItem, setSchedItem] = useState(null);   // item being scheduled/rescheduled
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedChannel, setSchedChannel] = useState('');
  const [schedChannelName, setSchedChannelName] = useState('');
  const [detail, setDetail] = useState(null);         // timeline event detail
  const [detailDate, setDetailDate] = useState('');
  const [detailTime, setDetailTime] = useState('09:00');
  const formRef = React.useRef(null);

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
  const scheduleFromApproved = (s) => {
    setScriptId(String(s.id));
    if (s.channel && channels.find((c) => c.key === s.channel)) setChannel(s.channel);
    setTitle(s.topic || '');
    if (formRef.current) formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const advance = async (id, status) => { try { await sched.advance(cid, id, status); load(); } catch (e) { setErr(e.message); } };
  const del = async (id) => { if (!window.confirm('Remove from planner?')) return; try { await sched.del(cid, id); load(); } catch (e) { setErr(e.message); } };

  const splitWhen = (v) => {
    const m = String(v || '').replace('T', ' ').match(/^(\d{4}-\d{2}-\d{2})[ ]?(\d{2}:\d{2})?/);
    return { d: m ? m[1] : '', t: (m && m[2]) || '09:00' };
  };
  const openSchedule = (item) => {
    const w = splitWhen(item.scheduled_for);
    setSchedItem(item); setSchedDate(w.d); setSchedTime(w.t);
    setSchedChannel(item.channel || ''); setSchedChannelName(item.channel_name || '');
  };
  const saveSchedule = async () => {
    if (!schedDate) { setErr('Pick a date to schedule.'); return; }
    try {
      await sched.update(cid, schedItem.id, {
        channel: schedChannel || schedItem.channel,
        channelName: schedChannelName || null,
        scheduledFor: `${schedDate} ${schedTime || '09:00'}`,
        status: 'scheduled',
      });
      setSchedItem(null); load();
    } catch (e) { setErr(e.message); }
  };
  const openDetail = (item) => {
    const w = splitWhen(item.scheduled_for);
    setDetail(item); setDetailDate(w.d); setDetailTime(w.t);
  };
  const saveDetailDate = async () => {
    if (!detailDate) { setErr('Pick a date.'); return; }
    try { await sched.update(cid, detail.id, { scheduledFor: `${detailDate} ${detailTime || '09:00'}` }); setDetail(null); load(); }
    catch (e) { setErr(e.message); }
  };
  const cancelEvent = async () => {
    if (!window.confirm('Cancel this event and remove it from the planner?')) return;
    try { await sched.del(cid, detail.id); setDetail(null); load(); } catch (e) { setErr(e.message); }
  };

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
      {onBackToStudio && <button className="btn sm" style={{ marginBottom: 10 }} onClick={onBackToStudio}><Icon name="arrow-l" size={12} /> Studio</button>}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="label">TIMELINE</div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={() => setWeekOffset(weekOffset - 1)}>‹ Earlier</button>
            <button className="btn sm" onClick={() => setWeekOffset(0)}>Today</button>
            <button className="btn sm" onClick={() => setWeekOffset(weekOffset + 1)}>Later ›</button>
          </div>
        </div>
        <Timeline items={items} channels={channels} weekOffset={weekOffset} onEventClick={openDetail} />
      </div>
      {approved.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <div className="label" style={{ marginBottom: 10 }}>READY TO DISTRIBUTE <span style={{ color: 'var(--text-4)' }}>({approved.length})</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {approved.map((s) => (
              <div key={s.id} className="card" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                  <span className="badge">{s.channel}</span>
                  <span className="mono" style={{ color: 'var(--ok)', fontSize: 11 }}>approved</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.topic || (s.body || '').slice(0, 80) || 'Untitled script'}</div>
                <div className="row" style={{ gap: 6, marginTop: 'auto' }}>
                  <button className="btn sm" onClick={() => scheduleFromApproved(s)}><Icon name="plus" size={12} /> Schedule</button>
                  <button className="btn sm" onClick={() => setPreview(s)}><Icon name="doc" size={12} /> Preview</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div ref={formRef} className="card card-pad" style={{ marginBottom: 14 }}>
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
                : byStatus(st).map((i) => <PlanCard key={i.id} item={i} onAdvance={advance} onDel={del} onSchedule={openSchedule} />)}
            </div>
          </div>
        ))}
      </div>

      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.55)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: 'min(680px, 96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="label">PREVIEW · {preview.channel}{preview.topic ? ' · ' + preview.topic : ''}</div>
              <button className="btn sm" onClick={() => setPreview(null)}>Close</button>
            </div>
            {preview.title && <div style={{ fontFamily: 'var(--f-display)', fontSize: 19 }}>{preview.title}</div>}
            {preview.description && <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{preview.description}</div>}
            <div style={{ overflow: 'auto', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 12, background: 'var(--surface)' }}>{preview.body}</div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn primary sm" onClick={() => { scheduleFromApproved(preview); setPreview(null); }}><Icon name="plus" size={12} /> Schedule this</button>
            </div>
          </div>
        </div>
      )}
      {schedItem && (
        <div onClick={() => setSchedItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.55)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: 'min(460px, 96vw)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="label">SCHEDULE · {schedItem.title || '(untitled)'}</div>
            <label className="col" style={{ gap: 4 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Channel</span>
              <select value={schedChannel} onChange={(e) => setSchedChannel(e.target.value)} style={inputStyle}>
                {[...new Set([schedItem.channel, ...channels.map((c) => c.key)])].filter(Boolean).map((k) => <option key={k} value={k}>{(channels.find((c) => c.key === k) || {}).label || k}</option>)}
              </select></label>
            <label className="col" style={{ gap: 4 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Channel name (outlet)</span>
              <input value={schedChannelName} onChange={(e) => setSchedChannelName(e.target.value)} placeholder="e.g. The Morning Brew Show" style={inputStyle} /></label>
            <div className="row" style={{ gap: 8 }}>
              <label className="col" style={{ gap: 4, flex: 1 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Publish date</span><input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} style={inputStyle} /></label>
              <label className="col" style={{ gap: 4, width: 120 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Time</span><input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} style={inputStyle} /></label>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn sm" onClick={() => setSchedItem(null)}>Cancel</button>
              <button className="btn primary sm" onClick={saveSchedule}><Icon name="check" size={12} /> Schedule</button>
            </div>
          </div>
        </div>
      )}
      {detail && (
        <div onClick={() => setDetail(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.55)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: 'min(520px, 96vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: colorOf(detail.channel), flex: 'none' }} />
                <div className="label">{detail.title || '(untitled)'}</div>
              </div>
              <button className="btn sm" onClick={() => setDetail(null)}>Close</button>
            </div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {(channels.find((c) => c.key === detail.channel) || {}).label || detail.channel}
              {detail.channel_name ? ' · ' + detail.channel_name : ''} · {detail.status}
            </div>
            {detail.script_body && <div style={{ overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 10, background: 'var(--surface)' }}>{detail.script_body}</div>}
            <div className="row" style={{ gap: 8 }}>
              <label className="col" style={{ gap: 4, flex: 1 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Publish date</span><input type="date" value={detailDate} onChange={(e) => setDetailDate(e.target.value)} style={inputStyle} /></label>
              <label className="col" style={{ gap: 4, width: 120 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Time</span><input type="time" value={detailTime} onChange={(e) => setDetailTime(e.target.value)} style={inputStyle} /></label>
            </div>
            <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
              <button className="btn sm" onClick={cancelEvent} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}><Icon name="close" size={12} /> Cancel event</button>
              <button className="btn primary sm" onClick={saveDetailDate}><Icon name="check" size={12} /> Save date</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { PlannerView };
