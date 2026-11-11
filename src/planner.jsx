import React, { useState, useEffect } from 'react'
import { Icon } from './shared.jsx'
import { sched, ep as epApi } from './dashboard-api.js'
import { api } from './api.js'
import { createPortal } from 'react-dom'

// Render modals at <body> so an ancestor's transform/scroll (.fade-in / .view)
// can't re-anchor a position:fixed overlay off-screen.
const Portal = ({ children }) => createPortal(children, document.body);

const CHAN_COLORS = {
  longform: '#fbb033', shortform: '#d6608f', blog: '#4a90d6', episode: '#6bbf8a',
  podcast: '#fbb033', transistor: '#fbb033', instagram: '#d6608f', linkedin: '#4a90d6', x: '#6bbf8a',
  youtube: '#c94a4a', facebook: '#4a6fd6', cast: '#6bbf8a',
  default: '#b09a8d',
};
const SOCIAL_CHANNELS = [
  { key: 'youtube', label: 'YouTube' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'transistor', label: 'Transistor (podcast)' },
];
const EXTRA_COLORS = ['#c96f4a', '#8a7ad6', '#4ab8a8', '#d6c04a'];
const colorFallback = (k) => EXTRA_COLORS[String(k).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % EXTRA_COLORS.length];
const colorOf = (k) => CHAN_COLORS[k] || colorFallback(k);

const inputStyle = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px', boxSizing: 'border-box', width: '100%' };
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.55)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 100 };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Cadence (set per client on the Episode Log): the longform airs on D0 = the
// weekday of the week-1 start date, SF1/2/3 on D+1/+2/+3, the blog on its own
// weekday, all at the client's post time. Used to pre-fill scheduling.
const cadenceD0 = (c) => { if (!c || !c.startDate) return null; const d = new Date(String(c.startDate).slice(0, 10) + 'T00:00:00'); return isNaN(d.getTime()) ? null : d.getDay(); };
const sfNumber = (title) => { const m = String(title || '').match(/\bSF\s*(\d)\b/i); return m ? Number(m[1]) : 0; };
// Weekday this episode should go out on, or null if the client has no cadence.
const cadenceWeekday = (c, title) => { const d0 = cadenceD0(c); return d0 == null ? null : (d0 + sfNumber(title)) % 7; };
// Next date (today counts) that falls on the given weekday.
const nextOnWeekday = (wd) => { const d = midnight(); while (d.getDay() !== wd) d.setDate(d.getDate() + 1); return d; };
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

// scheduled_for is stored as local "YYYY-MM-DD HH:MM[:SS]" text, so the date
// prefix and time slice are already in the user's own terms — no TZ math.
const dayKeyOf = (item) => String(item.scheduled_for || '').slice(0, 10);
const timeOf = (item) => { const m = String(item.scheduled_for || '').match(/[ T](\d{2}):(\d{2})/); return m ? `${m[1]}:${m[2]}` : ''; };
const fmt12 = (hhmm) => {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})/); if (!m) return '';
  let h = +m[1]; const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
};
const splitWhen = (v) => {
  const m = String(v || '').replace('T', ' ').match(/^(\d{4}-\d{2}-\d{2})[ ]?(\d{2}:\d{2})?/);
  return { d: m ? m[1] : '', t: (m && m[2]) || '09:00' };
};

// One dot + title chip for a day cell. Draft = faded, scheduled = solid,
// delivered = outlined with a check.
function DayChip({ item, onClick }) {
  const col = colorOf(item.channel);
  const delivered = item.status === 'delivered';
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(item); }}
      title={`${item.title || ''}${timeOf(item) ? ' · ' + fmt12(timeOf(item)) : ''} — ${item.status}`}
      style={{
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 5,
        fontSize: 11, lineHeight: 1.3, padding: '2px 5px', marginTop: 3, overflow: 'hidden',
        whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: 600,
        color: delivered ? 'var(--text-2)' : '#15120e',
        background: delivered ? 'transparent' : col,
        opacity: item.status === 'draft' ? 0.5 : 1,
        border: delivered ? `1.5px solid ${col}` : '1.5px solid transparent',
      }}
    >
      {delivered && <Icon name="check" size={10} />}
      {!!item.rerun && <span title="Republish">↻</span>}
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, flex: 'none', display: delivered ? 'block' : 'none' }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{timeOf(item) ? fmt12(timeOf(item)).replace(':00', '') + ' ' : ''}{item.title || '•'}</span>
    </div>
  );
}

// Active times: how this client's own past posts did by hour, for the weekday
// of the date being scheduled (Central time), plus the best 3 slots overall.
// Bars: height = score vs the client's average post (1.0 = average); faint =
// no posts at that hour yet. Click a bar or a "best" chip to use that time.
function ActiveTimes({ data, date, onPick }) {
  if (!data) return null;
  const sel = date ? new Date(date + 'T00:00:00') : null;
  const dow = sel && !isNaN(sel.getTime()) ? sel.getDay() : null;
  const slots = data.slots || [];
  const best = slots.filter((s) => s.posts >= 2).sort((a, b) => b.score - a.score).slice(0, 3);
  const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM – 10 PM
  const day = new Map(slots.filter((s) => s.dow === dow).map((s) => [s.hour, s]));
  const max = Math.max(1.5, ...slots.map((s) => s.score));
  const h12 = (h) => `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
  return (
    <div className="col" style={{ gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span className="mono" style={{ color: 'var(--text-4)' }}>Active times{dow != null ? ` · ${WEEKDAY_NAMES[dow]}` : ''}</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text-4)' }}>from {data.posts} past post{data.posts === 1 ? '' : 's'} · Central</span>
      </div>
      {data.posts === 0 ? (
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>No measured posts yet. Times show here once posts are 3+ days old.</div>
      ) : (
        <>
          <div className="row" style={{ gap: 2, alignItems: 'flex-end', height: 54 }}>
            {hours.map((h) => {
              const s = day.get(h);
              const pct = s ? Math.max(8, Math.min(100, (s.score / max) * 100)) : 8;
              return (
                <button key={h} type="button" onClick={() => onPick(null, `${pad2(h)}:00`)}
                  title={s ? `${fmt12(pad2(h) + ':00')}: ${s.score}× your average post · ~${s.avgViews} views · ${s.posts} post${s.posts === 1 ? '' : 's'}` : `${fmt12(pad2(h) + ':00')}: no posts at this hour yet`}
                  style={{ flex: 1, height: `${pct}%`, padding: 0, border: 'none', borderRadius: 2, cursor: 'pointer',
                    background: s ? (s.score >= 1 ? 'var(--ok)' : 'var(--text-4)') : 'var(--border)', opacity: s ? 1 : 0.5 }} />
              );
            })}
          </div>
          <div className="row" style={{ gap: 2 }}>
            {hours.map((h) => <span key={h} className="mono" style={{ flex: 1, fontSize: 9, color: 'var(--text-4)', textAlign: 'center' }}>{h % 3 === 0 ? h12(h) : ''}</span>)}
          </div>
          {best.length > 0 && (
            <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>Best so far:</span>
              {best.map((s) => (
                <button key={`${s.dow}-${s.hour}`} type="button" className="btn sm" onClick={() => onPick(ymd(nextOnWeekday(s.dow)), `${pad2(s.hour)}:00`)}
                  title={`${s.score}× your average post · ~${s.avgViews} views · ${s.posts} posts`}>
                  {WEEKDAYS[s.dow]} {fmt12(pad2(s.hour) + ':00')}
                </button>
              ))}
            </div>
          )}
          <div className="mono" style={{ fontSize: 10, color: 'var(--text-4)' }}>Based only on when this client's posts went out and how they did, not on when followers are online. Spreading posts across more times makes this more useful.</div>
        </>
      )}
    </div>
  );
}

function CalendarGrid({ mode, anchor, items, todayKey, onEventClick, onDayClick }) {
  let days;
  if (mode === 'week') {
    const start = new Date(anchor); start.setDate(anchor.getDate() - anchor.getDay());
    days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  } else {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = new Date(first); start.setDate(1 - first.getDay());
    days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }
  const curMonth = anchor.getMonth();
  const cellMin = mode === 'week' ? 220 : 96;
  // Minimum width per day column so the days stay readable; if 7 columns don't
  // fit the screen, the calendar scrolls horizontally instead of squishing.
  const colMin = mode === 'week' ? 200 : 130;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, minmax(${colMin}px, 1fr))`, minWidth: 7 * colMin }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ padding: '7px 0', textAlign: 'center', fontSize: 11, letterSpacing: 0.4, color: 'var(--text-4)', fontFamily: 'var(--f-mono)', borderBottom: '1px solid var(--border)' }}>{w}</div>
        ))}
        {days.map((d, i) => {
          const key = ymd(d);
          const dayItems = items.filter((it) => dayKeyOf(it) === key).sort((a, b) => timeOf(a).localeCompare(timeOf(b)));
          const isToday = d.toDateString() === todayKey;
          const outside = mode === 'month' && d.getMonth() !== curMonth;
          return (
            <div
              key={i}
              onClick={() => onDayClick(d)}
              style={{
                minHeight: cellMin, padding: '4px 5px 6px', cursor: 'pointer',
                borderLeft: i % 7 === 0 ? 'none' : '1px solid var(--border)',
                borderTop: i >= 7 ? '1px solid var(--border)' : 'none',
                background: isToday ? 'rgba(251,176,51,0.10)' : 'transparent',
                opacity: outside ? 0.4 : 1, display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{ fontSize: 11, fontFamily: 'var(--f-mono)', color: isToday ? 'var(--accent)' : 'var(--text-4)', fontWeight: isToday ? 700 : 400, textAlign: 'right' }}>{d.getDate()}</div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {dayItems.map((it) => <DayChip key={it.id} item={it} onClick={onEventClick} />)}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

const PlannerView = ({ activeClientId, onSelectClient, onCastScript, onBackToStudio }) => {
  const cid = activeClientId;
  const [clientList, setClientList] = useState([]);   // for the client dropdown (top of the planner, or "pick a client")
  useEffect(() => { api.listClients().then((cs) => setClientList(Array.isArray(cs) ? cs : (cs && cs.clients) || [])).catch(() => setClientList([])); }, []);
  const [items, setItems] = useState([]);
  const [activeTimes, setActiveTimes] = useState(null); // own-post performance by weekday/hour
  useEffect(() => { if (cid == null) return; sched.activeTimes(cid).then(setActiveTimes).catch(() => setActiveTimes(null)); }, [cid]);
  const [cadence, setCadence] = useState(null);   // { startDate, blogDay, postTime } from the Episode Log
  useEffect(() => {
    if (cid == null) return;   // no client = the "pick a client" screen, which never reads cadence
    api.getClient(cid).then((c) => setCadence({ startDate: c.start_date || null, blogDay: c.blog_day || null, postTime: c.post_time || null })).catch(() => setCadence(null));
  }, [cid]);
  // Pre-filled date + time for scheduling an episode, from the cadence.
  const cadenceWhen = (title) => {
    const wd = cadenceWeekday(cadence, title);
    return { d: wd == null ? ymd(midnight()) : ymd(nextOnWeekday(wd)), t: (cadence && cadence.postTime) || '09:00' };
  };
  const [channels, setChannels] = useState([]);
  const [approved, setApproved] = useState([]);   // approved scripts (optional attach on manual posts)
  const [episodes, setEpisodes] = useState([]);   // finished episodes to distribute (approved, or added by hand)
  const [airedEps, setAiredEps] = useState([]);    // finished episodes marked aired / removed from the list — can be put back
  const [showAired, setShowAired] = useState(false);
  const [plannedEps, setPlannedEps] = useState([]); // finished episodes with posts already scheduled or posted
  const [showPlanned, setShowPlanned] = useState(false);
  const [publishing, setPublishing] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [mode, setMode] = useState('month');
  const [anchor, setAnchor] = useState(midnight());

  const [detail, setDetail] = useState(null);       // existing schedule item
  const [detailDate, setDetailDate] = useState('');
  const [detailTime, setDetailTime] = useState('09:00');

  const [dist, setDist] = useState(null);           // episode being distributed
  const [distChannels, setDistChannels] = useState(new Set());
  const [distFeed, setDistFeed] = useState(false);
  const [distDate, setDistDate] = useState('');
  const [distTime, setDistTime] = useState('09:00');
  const [distBusy, setDistBusy] = useState(false);
  const [distRerun, setDistRerun] = useState(false); // republishing an aired episode
  const [distTitle, setDistTitle] = useState('');

  const [newPost, setNewPost] = useState(false);    // manual post (from an empty day)
  const [npChannel, setNpChannel] = useState('');
  const [npTitle, setNpTitle] = useState('');
  const [npScriptId, setNpScriptId] = useState('');
  const [npDate, setNpDate] = useState('');
  const [npTime, setNpTime] = useState('09:00');

  const load = () => {
    if (cid == null) { setLoading(false); return; }
    setLoading(true); setErr('');
    Promise.all([
      sched.list(cid).catch(() => []),
      sched.channels().catch(() => []),
      sched.approvedScripts(cid).catch(() => []),
      epApi.list(cid).catch(() => []),
    ]).then(([it, ch, sc, eps]) => {
      setItems(Array.isArray(it) ? it : (it.items || []));
      const chans = Array.isArray(ch) ? ch : [];
      setChannels(chans);
      const scr = Array.isArray(sc) ? sc : (sc.scripts || []);
      setApproved(scr.filter((s) => s.status === 'approved'));
      const epsArr = Array.isArray(eps) ? eps : (eps.episodes || []);
      const itArr = Array.isArray(it) ? it : (it.items || []);
      // A stitched episode (video or audio) is distributable once the client has approved it
      // (with or without changes) OR it was added to the planner by hand with "Add to planner".
      // Distribute is only for episodes with nothing planned yet: once any post is
      // scheduled or posted it moves to "Scheduled / posted" below (still editable
      // there), and once it has an air date it moves to "Marked aired".
      const linked = new Set(itArr.filter((i) => i.episode_id).map((i) => i.episode_id));
      const planned = new Set(itArr.filter((i) => i.episode_id && SOCIAL_CHANNELS.some((s) => s.key === i.channel) && (i.status === 'scheduled' || i.status === 'delivered')).map((i) => i.episode_id));
      const finished = (e) => e.hasVideo || e.hasOutput;
      const cleared = (e) => e.approval_status === 'approved' || e.approval_status === 'approved_with_changes' || linked.has(e.id);
      setEpisodes(epsArr.filter((e) => finished(e) && cleared(e) && !e.air_date && !planned.has(e.id)));
      setPlannedEps(epsArr.filter((e) => finished(e) && cleared(e) && !e.air_date && planned.has(e.id)));
      setAiredEps(epsArr.filter((e) => finished(e) && cleared(e) && e.air_date));
    }).catch((e) => setErr(e.message || 'Could not load planner.')).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [cid]);

  const del = async (id) => { if (!window.confirm('Remove from planner?')) return; try { await sched.del(cid, id); load(); } catch (e) { setErr(e.message); } };
  const advance = async (id, status) => { try { await sched.advance(cid, id, status); load(); } catch (e) { setErr(e.message); } };

  // --- calendar nav ---
  const step = (dir) => {
    if (mode === 'week') { const d = new Date(anchor); d.setDate(anchor.getDate() + dir * 7); setAnchor(d); }
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
  };
  const label = mode === 'week'
    ? (() => { const s = new Date(anchor); s.setDate(anchor.getDate() - anchor.getDay()); const e = new Date(s); e.setDate(s.getDate() + 6); return `${s.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${e.getFullYear()}`; })()
    : anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  // --- existing-item detail (reschedule / cancel / publish) ---
  const openDetail = (item) => { const w = splitWhen(item.scheduled_for); setDetail(item); setDetailDate(w.d); setDetailTime(w.t); };
  const saveDetailDate = async () => {
    if (!detailDate) { setErr('Pick a date.'); return; }
    try { await sched.update(cid, detail.id, { scheduledFor: `${detailDate} ${detailTime || '09:00'}`, status: 'scheduled' }); setDetail(null); load(); }
    catch (e) { setErr(e.message); }
  };
  const cancelEvent = async () => {
    if (!window.confirm('Cancel this event and remove it from the planner?')) return;
    try { await sched.del(cid, detail.id); setDetail(null); load(); } catch (e) { setErr(e.message); }
  };
  const publishItem = async (item) => {
    setPublishing((prev) => new Set(prev).add(item.id));
    try {
      if (item.channel === 'transistor') await epApi.publishTransistor(cid, item.episode_id, item.id);
      else await epApi.publish(cid, item.episode_id, [item.channel], item.id);
    }
    catch { /* server records the error in publish_meta */ }
    setPublishing((prev) => { const next = new Set(prev); next.delete(item.id); return next; });
    setDetail(null); load();
  };

  // --- distribute an approved+rendered episode ---
  const openDistribute = (epi) => {
    const mine = items.filter((i) => i.episode_id === epi.id);
    setDist(epi); setDistRerun(false);
    setDistChannels(new Set(mine.map((i) => i.channel).filter((c) => SOCIAL_CHANNELS.some((s) => s.key === c))));
    setDistFeed(!!epi.feedInclude);
    const w = splitWhen(mine[0] && mine[0].scheduled_for);
    const cw = cadenceWhen(epi.title);
    const has = !!(mine[0] && mine[0].scheduled_for);   // reuse an existing post's date/time, else the cadence's
    setDistDate(has && w.d ? w.d : cw.d); setDistTime(has ? w.t : cw.t);
  };
  // Republish an episode that already aired: brand-new Planner rows (the
  // original delivered posts stay as history), each going out with this title.
  // Transistor gets a fresh feed episode — it can't re-air the original one.
  const openRerun = (epi) => {
    setDist(epi); setDistRerun(true);
    setDistChannels(new Set());
    setDistTitle(`Encore: ${String(epi.title || '').replace(/^\s*encore:\s*/i, '')}`);
    const cw = cadenceWhen(epi.title);
    setDistDate(cw.d); setDistTime(cw.t);
  };
  const toggleDistChannel = (key) => setDistChannels((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  // Remove an episode from the Distribute list by marking it aired (today).
  const markAired = async (epi) => {
    if (!window.confirm(`Remove "${epi.title}" from Distribute? It will be marked aired today. You can put it back from “Marked aired” below.`)) return;
    try { await epApi.setMeta(cid, epi.id, { airDate: ymd(midnight()) }); load(); } catch (e) { setErr(e.message); }
  };
  // Undo a mark-aired (or an automatic air date from publishing): the episode returns to Distribute.
  const putBack = async (epi) => {
    try { await epApi.setMeta(cid, epi.id, { airDate: '' }); load(); } catch (e) { setErr(e.message); }
  };
  const saveDistribute = async () => {
    const chans = [...distChannels];
    if (distRerun) {
      if (!chans.length) { setErr('Pick at least one channel to republish to.'); return; }
      if (!distDate) { setErr('Pick a date for the republish.'); return; }
      if (!distTitle.trim()) { setErr('Give the republish a title.'); return; }
      setDistBusy(true); setErr('');
      try {
        for (const ch of chans) await sched.add(cid, { channel: ch, title: distTitle.trim(), episodeId: dist.id, scheduledFor: `${distDate} ${distTime || '09:00'}`, rerun: true });
        setDist(null); load();
      } catch (e) { setErr(e.message); }
      finally { setDistBusy(false); }
      return;
    }
    if (!chans.length && distFeed === !!dist.feedInclude) { setErr('Pick at least one channel, or change the podcast-feed setting.'); return; }
    if (chans.length && !distDate) { setErr('Pick a date to schedule the social posts.'); return; }
    const when = `${distDate} ${distTime || '09:00'}`;
    setDistBusy(true); setErr('');
    try {
      if (distFeed !== !!dist.feedInclude) await epApi.setMeta(cid, dist.id, { feedInclude: distFeed });
      for (const ch of chans) {
        const existing = items.find((i) => i.episode_id === dist.id && i.channel === ch);
        if (existing) await sched.update(cid, existing.id, { scheduledFor: when, status: 'scheduled' });
        else await sched.add(cid, { channel: ch, title: dist.title, episodeId: dist.id, scheduledFor: when });
      }
      setDist(null); load();
    } catch (e) { setErr(e.message); }
    finally { setDistBusy(false); }
  };

  // --- manual post from an empty day ---
  const openNewPost = (day) => { setNewPost(true); setNpDate(ymd(day)); setNpTime((cadence && cadence.postTime) || '09:00'); setNpChannel(channels[0] ? channels[0].key : ''); setNpTitle(''); setNpScriptId(''); };
  const saveNewPost = async () => {
    if (!npChannel) { setErr('Pick a channel.'); return; }
    const body = { channel: npChannel, title: npTitle };
    if (npDate) body.scheduledFor = `${npDate} ${npTime || '09:00'}`;
    if (npScriptId) body.scriptId = Number(npScriptId);
    try { await sched.add(cid, body); setNewPost(false); load(); } catch (e) { setErr(e.message); }
  };

  if (cid == null) {
    return (
      <div className="v-pad">
        <div className="card card-pad" style={{ borderStyle: 'dashed' }}>
          <div className="label" style={{ marginBottom: 6 }}>PLANNER</div>
          <div className="mono" style={{ color: 'var(--text-3)', marginBottom: 10 }}>The planner is per client — pick one to view its schedule.</div>
          <select
            value=""
            onChange={(e) => { const id = Number(e.target.value); if (id && onSelectClient) onSelectClient(id); }}
            style={{ height: 38, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 14, minWidth: 240 }}
          >
            <option value="">Pick a client…</option>
            {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
    );
  }

  const todayKey = new Date().toDateString();
  // Any planner item backed by an episode can be published now (all channels).
  // Podcast channels publish the audio; social/video channels need a stitched video.
  const isEpisodeItem = !!(detail && detail.episode_id);
  const isPodcastChannel = !!(detail && (detail.channel === 'transistor' || detail.channel === 'podcast'));
  const needsVideo = isEpisodeItem && !isPodcastChannel;
  const needsAudio = isEpisodeItem && isPodcastChannel;
  const mediaMissing = (needsVideo && detail?.episode_has_video === false) || (needsAudio && detail?.episode_has_audio === false);
  const detailMeta = (() => { if (!detail || !detail.publish_meta) return null; try { return JSON.parse(detail.publish_meta); } catch { return null; } })();

  return (
    <div className="v-pad fade-in">
      <div className="row" style={{ gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        {onBackToStudio && <button className="btn sm" onClick={onBackToStudio}><Icon name="arrow-l" size={12} /> Studio</button>}
        <span className="label" style={{ margin: 0 }}>CLIENT</span>
        <select value={cid || ''} onChange={(e) => { const id = Number(e.target.value); if (id && onSelectClient) onSelectClient(id); }}
          style={{ height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 14, minWidth: 240 }}>
          {!clientList.some((c) => c.id === cid) && <option value={cid || ''}>Loading clients…</option>}
          {clientList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Cadence (from the Episode Log) */}
      <div className="card card-pad" style={{ marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="label" style={{ margin: 0 }}>CADENCE</span>
        {cadence && (cadence.startDate || cadence.blogDay || cadence.postTime) ? (() => {
          const d0 = cadenceD0(cadence);
          const parts = [];
          if (d0 != null) {
            parts.push(['Longform', WEEKDAY_NAMES[d0] + 's']);
            parts.push(['SF1 / SF2 / SF3', [1, 2, 3].map((n) => WEEKDAYS[(d0 + n) % 7]).join(' / ')]);
          }
          if (cadence.blogDay) parts.push(['Blog', cadence.blogDay + 's']);
          if (cadence.postTime) parts.push(['Post time', fmt12(cadence.postTime) + ' Central']);
          return parts.map(([k, v]) => (
            <span key={k} className="mono" style={{ fontSize: 12 }}><span style={{ color: 'var(--text-4)' }}>{k}</span> <span style={{ color: 'var(--text)', fontWeight: 600 }}>{v}</span></span>
          ));
        })() : <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>Not set for this client.</span>}
        <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 'auto' }}>Edit in Episode Log → Cadence. Scheduling pre-fills these days and time.</span>
      </div>

      {/* Calendar */}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <button className="btn sm" onClick={() => step(-1)} title="Previous">‹</button>
            <button className="btn sm" onClick={() => setAnchor(midnight())}>Today</button>
            <button className="btn sm" onClick={() => step(1)} title="Next">›</button>
            <div style={{ fontFamily: 'var(--f-display)', fontSize: 18, marginLeft: 8 }}>{label}</div>
          </div>
          <div className="row" style={{ gap: 0, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
            {['month', 'week'].map((m) => (
              <button key={m} className="btn sm" onClick={() => setMode(m)}
                style={{ borderRadius: 0, border: 'none', textTransform: 'capitalize', background: mode === m ? 'var(--surface-2)' : 'transparent', color: mode === m ? 'var(--accent)' : 'var(--text-3)', fontWeight: mode === m ? 700 : 400 }}>{m}</button>
            ))}
          </div>
        </div>
        <CalendarGrid mode={mode} anchor={anchor} items={items} todayKey={todayKey} onEventClick={openDetail} onDayClick={openNewPost} />
        <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 8 }}>Click a day to plan a post · click a chip to reschedule, publish, or cancel · faded = draft, solid = scheduled, outlined ✓ = delivered</div>
      </div>

      {/* Distribute finished + approved episodes */}
      <div className="card card-pad" style={{ marginBottom: 14 }}>
        <div className="label" style={{ marginBottom: 10 }}>DISTRIBUTE AN EPISODE <span style={{ color: 'var(--text-4)' }}>({episodes.length})</span></div>
        {episodes.length === 0 ? (
          <div className="mono" style={{ color: 'var(--text-4)' }}>Nothing waiting to be scheduled — an episode appears here once it's stitched and approved by the client (or you click “Add to planner” on it), and leaves as soon as a post for it is scheduled.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
            {episodes.map((epi) => {
              const scheduledCount = items.filter((i) => i.episode_id === epi.id && SOCIAL_CHANNELS.some((s) => s.key === i.channel)).length;
              return (
                <div key={epi.id} className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{epi.title}</div>
                  <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {epi.approval_status !== 'approved' && epi.approval_status !== 'approved_with_changes' && <span className="mono" style={{ fontSize: 11, color: 'var(--warn)' }}>awaiting client approval</span>}
                    <span className="mono" style={{ fontSize: 11, color: epi.feedInclude ? 'var(--ok)' : 'var(--text-4)' }}>{epi.feedInclude ? '● podcast feed' : '○ feed off'}</span>
                    {scheduledCount > 0 && <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{scheduledCount} scheduled</span>}
                  </div>
                  <div className="row" style={{ gap: 6, marginTop: 'auto' }}>
                    <button className="btn primary sm" style={{ flex: 1 }} onClick={() => openDistribute(epi)}><Icon name="send" size={12} /> Schedule</button>
                    <button className="btn sm" onClick={() => markAired(epi)} title="Mark aired &amp; remove from this list">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {plannedEps.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <button className="btn sm" onClick={() => setShowPlanned(!showPlanned)}>{showPlanned ? '▾' : '▸'} Scheduled / posted ({plannedEps.length})</button>
          {showPlanned && (
            <div className="col" style={{ gap: 6, marginTop: 10 }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>Episodes with posts on the calendar. Use “Schedule” to add or move channels.</div>
              {plannedEps.map((epi) => {
                const mine = items.filter((i) => i.episode_id === epi.id && SOCIAL_CHANNELS.some((s) => s.key === i.channel));
                const posted = mine.filter((i) => i.status === 'delivered').length;
                const waiting = mine.filter((i) => i.status === 'scheduled').sort((a, b) => String(a.scheduled_for).localeCompare(String(b.scheduled_for)));
                return (
                  <div key={epi.id} className="row" style={{ gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={epi.title}>{epi.title}</div>
                    {posted > 0 && <span className="mono" style={{ fontSize: 11, color: 'var(--ok)' }}>{posted} posted</span>}
                    {waiting.length > 0 && <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{waiting.length} scheduled · next {String(waiting[0].scheduled_for || '').slice(0, 16)}</span>}
                    <button className="btn sm" onClick={() => openDistribute(epi)}><Icon name="send" size={12} /> Schedule</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {airedEps.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 14 }}>
          <button className="btn sm" onClick={() => setShowAired(!showAired)}>{showAired ? '▾' : '▸'} Marked aired / removed ({airedEps.length})</button>
          {showAired && (
            <div className="col" style={{ gap: 6, marginTop: 10 }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>Episodes with an air date drop off “Distribute an episode”. Use “Put back” if one was removed by mistake, “Schedule” to plan posts for it anyway, or “Republish” to run it again as new posts (the podcast gets a new encore episode).</div>
              {airedEps.map((epi) => (
                <div key={epi.id} className="row" style={{ gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{epi.title}</div>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>aired {epi.air_date}</span>
                  <button className="btn sm" onClick={() => putBack(epi)}>Put back</button>
                  <button className="btn sm" onClick={() => openDistribute(epi)}><Icon name="send" size={12} /> Schedule</button>
                  <button className="btn primary sm" onClick={() => openRerun(epi)} title="Run it again on socials and the podcast as a new post">↻ Republish</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      {loading && <div className="mono" style={{ color: 'var(--text-3)' }}>Loading planner…</div>}

      {/* Distribute modal */}
      {dist && (
        <Portal><div onClick={() => setDist(null)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: 'min(480px, 96vw)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="label">{distRerun ? 'REPUBLISH' : 'SCHEDULE'} · {dist.title}</div>
            {distRerun && (
              <label className="col" style={{ gap: 4 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Title for the rerun</span>
                <input value={distTitle} onChange={(e) => setDistTitle(e.target.value)} style={inputStyle} /></label>
            )}
            <div className="col" style={{ gap: 6 }}>
              <span className="mono" style={{ color: 'var(--text-4)' }}>Social channels</span>
              {SOCIAL_CHANNELS.map((c) => (
                <label key={c.key} className="row" style={{ gap: 8, alignItems: 'center', fontSize: 13 }}>
                  <input type="checkbox" checked={distChannels.has(c.key)} onChange={() => toggleDistChannel(c.key)} />
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: colorOf(c.key), flex: 'none' }} />
                  <span>{c.label}</span>
                </label>
              ))}
            </div>
            {!distRerun && (
            <label className="row" style={{ gap: 8, alignItems: 'center', fontSize: 13, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <input type="checkbox" checked={distFeed} onChange={(e) => setDistFeed(e.target.checked)} />
              <span>Also include in the podcast feed</span>
            </label>
            )}
            <div className="row" style={{ gap: 8 }}>
              <label className="col" style={{ gap: 4, flex: 1 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Publish date</span><input type="date" value={distDate} onChange={(e) => setDistDate(e.target.value)} style={inputStyle} /></label>
              <label className="col" style={{ gap: 4, width: 120 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Time</span><input type="time" value={distTime} onChange={(e) => setDistTime(e.target.value)} style={inputStyle} /></label>
            </div>
            <ActiveTimes data={activeTimes} date={distDate} onPick={(d, t) => { if (d) setDistDate(d); setDistTime(t); }} />
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{distRerun
              ? 'Each checked channel gets a new post with this title on that date; it goes out automatically at that time. Transistor gets a new episode (no episode number); the original stays in the feed.'
              : 'Each checked channel gets a scheduled post on that date. Publish it from its calendar chip when ready.'}</div>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn sm" onClick={() => setDist(null)}>Cancel</button>
              <button className="btn primary sm" disabled={distBusy} onClick={saveDistribute}><Icon name="check" size={12} /> {distBusy ? 'Saving…' : (distRerun ? 'Schedule republish' : 'Schedule')}</button>
            </div>
          </div>
        </div></Portal>
      )}

      {/* Manual new-post modal (empty day) */}
      {newPost && (
        <Portal><div onClick={() => setNewPost(false)} style={overlayStyle}>
          <div onClick={(e) => e.stopPropagation()} className="card card-pad" style={{ width: 'min(460px, 96vw)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="label">PLAN A POST</div>
            <label className="col" style={{ gap: 4 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Channel</span>
              <select value={npChannel} onChange={(e) => setNpChannel(e.target.value)} style={inputStyle}>{channels.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
            <label className="col" style={{ gap: 4 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Title</span>
              <input value={npTitle} onChange={(e) => setNpTitle(e.target.value)} placeholder="Episode / post name" style={inputStyle} /></label>
            <div className="row" style={{ gap: 8 }}>
              <label className="col" style={{ gap: 4, flex: 1 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Date</span><input type="date" value={npDate} onChange={(e) => setNpDate(e.target.value)} style={inputStyle} /></label>
              <label className="col" style={{ gap: 4, width: 120 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Time</span><input type="time" value={npTime} onChange={(e) => setNpTime(e.target.value)} style={inputStyle} /></label>
            </div>
            {approved.length > 0 && (
              <label className="col" style={{ gap: 4 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Attach approved script (optional)</span>
                <select value={npScriptId} onChange={(e) => setNpScriptId(e.target.value)} style={inputStyle}>
                  <option value="">— none —</option>
                  {approved.map((s) => <option key={s.id} value={s.id}>{s.channel}: {(s.topic || s.body || '').slice(0, 40)}</option>)}
                </select></label>
            )}
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn sm" onClick={() => setNewPost(false)}>Cancel</button>
              <button className="btn primary sm" onClick={saveNewPost}><Icon name="plus" size={12} /> Add to planner</button>
            </div>
          </div>
        </div></Portal>
      )}

      {/* Existing-item detail modal */}
      {detail && (
        <Portal><div onClick={() => setDetail(null)} style={overlayStyle}>
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
              {timeOf(detail) ? ' · ' + fmt12(timeOf(detail)) : ''}
            </div>
            {needsVideo && detail.episode_has_video === false && (
              <div className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>No video on this episode yet — stitch it first.</div>
            )}
            {needsAudio && detail.episode_has_audio === false && (
              <div className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>No audio on this episode yet — stitch it first.</div>
            )}
            {detailMeta && detailMeta.ok === false && (
              <div className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>Last attempt failed: {detailMeta.error}</div>
            )}
            {detail.script_body && <div style={{ overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.6, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 10, background: 'var(--surface)' }}>{detail.script_body}</div>}
            <div className="row" style={{ gap: 8 }}>
              <label className="col" style={{ gap: 4, flex: 1 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Publish date</span><input type="date" value={detailDate} onChange={(e) => setDetailDate(e.target.value)} style={inputStyle} /></label>
              <label className="col" style={{ gap: 4, width: 120 }}><span className="mono" style={{ color: 'var(--text-4)' }}>Time</span><input type="time" value={detailTime} onChange={(e) => setDetailTime(e.target.value)} style={inputStyle} /></label>
            </div>
            {detail.status !== 'delivered' && <ActiveTimes data={activeTimes} date={detailDate} onPick={(d, t) => { if (d) setDetailDate(d); setDetailTime(t); }} />}
            <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn sm" onClick={cancelEvent} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}><Icon name="close" size={12} /> Cancel event</button>
              <div className="row" style={{ gap: 8 }}>
                {isEpisodeItem && detail.status === 'delivered' && (
                  <button className="btn sm" title="Run this episode again on socials and the podcast as new posts"
                    onClick={() => {
                      const epi = [...airedEps, ...plannedEps, ...episodes].find((e) => e.id === detail.episode_id)
                        || { id: detail.episode_id, title: detail.episode_title || detail.title || '' };
                      setDetail(null); openRerun(epi);
                    }}>↻ Republish</button>
                )}
                {isEpisodeItem && (
                  <button className="btn sm primary" disabled={publishing.has(detail.id) || mediaMissing} onClick={() => publishItem(detail)}>
                    {publishing.has(detail.id) ? 'Publishing…' : <><Icon name="check" size={12} /> Publish now</>}
                  </button>
                )}
                {!isEpisodeItem && detail.status === 'scheduled' && (
                  <button className="btn sm" onClick={() => { advance(detail.id, 'delivered'); setDetail(null); }}>Mark delivered</button>
                )}
                <button className="btn primary sm" onClick={saveDetailDate}><Icon name="check" size={12} /> Save date</button>
              </div>
            </div>
          </div>
        </div></Portal>
      )}
    </div>
  );
};

export { PlannerView };
