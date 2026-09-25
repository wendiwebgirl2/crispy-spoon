import React from 'react'
import { Icon } from './shared.jsx'
import { api } from './api.js'
import cuecastLogo from './assets/cuecast-logo.svg'

// Client-facing portal (Slice 14). A separate shell from the staff dashboard,
// shown when the signed-in account has role='client'. Everything it reads/writes
// is scoped server-side to the one client the account belongs to (/api/portal/*).

const MENU = [
  { id: 'approve', label: 'Needs Approval', icon: 'check', badge: 'needsApproval' },
  { id: 'onboarding', label: 'Onboarding', icon: 'check' },
  { id: 'production', label: 'In Production', icon: 'studio', badge: 'inProduction' },
  { id: 'episodes', label: 'Past Episodes', icon: 'history', badge: 'pastEpisodes' },
  { id: 'avatars', label: 'Avatars', icon: 'avatars' },
  { id: 'topics', label: 'Topic Suggestions', icon: 'sparkle' },
  { id: 'contract', label: 'Agreement', icon: 'doc' },
  { id: 'account', label: 'Account', icon: 'settings' },
  { id: 'help', label: 'Help', icon: 'chat' },
];

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 16 };
const inputStyle = { width: '100%', background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '10px 12px' };

function Empty({ children }) {
  return <div className="mono" style={{ color: 'var(--text-4)', padding: '18px 0' }}>{children}</div>;
}
function SectionHead({ title, sub }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 28, lineHeight: 1.1, margin: '0 0 4px' }}>{title}</h1>
      {sub && <div className="mono" style={{ color: 'var(--text-3)', fontSize: 13 }}>{sub}</div>}
    </div>
  );
}

// ---- Needs Approval --------------------------------------------------------
function NeedsApproval({ onChanged }) {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(null);
  const [changeFor, setChangeFor] = React.useState(null); // `${type}:${id}`
  const [note, setNote] = React.useState('');
  const load = () => api.portalNeedsApproval().then(setData).catch((e) => setErr(e.message));
  React.useEffect(() => { load(); }, []);

  const decide = async (item, decision) => {
    const key = `${item.type}:${item.id}`;
    setBusy(key); setErr('');
    try {
      await api.portalApprove({ type: item.type, id: item.id, decision, comment: decision === 'changes_requested' ? note.trim() : '' });
      setChangeFor(null); setNote('');
      await load(); onChanged && onChanged();
    } catch (e) { setErr(e.message); } finally { setBusy(null); }
  };

  const items = data ? [...data.scripts, ...data.casts, ...data.episodes] : [];
  const typeLabel = { script: 'Script', cast: 'Avatar video', episode: 'Episode' };

  return (
    <div className="fade-in">
      <SectionHead title="Needs approval" sub="Review each item, then approve it or ask for changes." />
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      {!data ? <Empty>Loading…</Empty>
        : items.length === 0 ? <Empty>Nothing waiting on you right now. 🎉</Empty>
        : <div className="col" style={{ gap: 12 }}>
          {items.map((item) => {
            const key = `${item.type}:${item.id}`;
            return (
              <div key={key} style={card}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <span className="badge" style={{ marginRight: 8 }}>{typeLabel[item.type]}</span>
                    <strong style={{ fontSize: 15 }}>{item.title}</strong>
                    {item.channel && <span className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginLeft: 8 }}>{item.channel}</span>}
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm primary" disabled={busy === key} onClick={() => decide(item, 'approved')}><Icon name="check" size={12} /> Approve</button>
                    <button className="btn sm" disabled={busy === key} onClick={() => { setChangeFor(changeFor === key ? null : key); setNote(''); }}>Request changes</button>
                  </div>
                </div>
                {item.type === 'script' && item.body && (
                  <div className="mono" style={{ whiteSpace: 'pre-wrap', color: 'var(--text-2)', fontSize: 13, marginTop: 10, maxHeight: 220, overflow: 'auto', borderTop: '1px solid var(--border)', paddingTop: 10 }}>{item.body}</div>
                )}
                {(item.type === 'cast' || item.type === 'episode') && (
                  <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12, marginTop: 8 }}>Your producer has shared this for your review.</div>
                )}
                {changeFor === key && (
                  <div style={{ marginTop: 10 }}>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What would you like changed?" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                    <div className="row" style={{ gap: 6, marginTop: 6 }}>
                      <button className="btn sm primary" disabled={busy === key || !note.trim()} onClick={() => decide(item, 'changes_requested')}>Send change request</button>
                      <button className="btn sm" onClick={() => { setChangeFor(null); setNote(''); }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>}
    </div>
  );
}

// ---- In Production ---------------------------------------------------------
function InProduction() {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  React.useEffect(() => { api.portalInProduction().then(setData).catch((e) => setErr(e.message)); }, []);
  const items = data ? data.items : [];
  return (
    <div className="fade-in">
      <SectionHead title="In production" sub="Approved and on our workbench — you'll see finished pieces under Past Episodes." />
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      {!data ? <Empty>Loading…</Empty>
        : items.length === 0 ? <Empty>Nothing in production right now.</Empty>
        : <div className="col" style={{ gap: 8 }}>
          {items.map((it) => (
            <div key={`${it.type}:${it.id}`} className="row" style={{ ...card, justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{it.title}</strong>
              <span className="mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>{it.stage}</span>
            </div>
          ))}
        </div>}
    </div>
  );
}

// ---- Past Episodes ---------------------------------------------------------
function PastEpisodes() {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  React.useEffect(() => { api.portalEpisodes().then(setData).catch((e) => setErr(e.message)); }, []);
  const eps = data ? data.episodes : [];
  return (
    <div className="fade-in">
      <SectionHead title="Past episodes" sub="Your finished pieces — play or download any of them." />
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      {!data ? <Empty>Loading…</Empty>
        : eps.length === 0 ? <Empty>No finished episodes yet.</Empty>
        : <div className="col" style={{ gap: 12 }}>
          {eps.map((e) => (
            <div key={e.id} style={card}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ fontSize: 15 }}>{e.title}</strong>
                  {e.created_at && <span className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginLeft: 8 }}>{String(e.created_at).slice(0, 10)}</span>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {e.hasVideo && <a className="btn sm" href={api.portalEpisodeVideoUrl(e.id)} target="_blank" rel="noreferrer"><Icon name="download" size={12} /> Video</a>}
                  {e.hasAudio && <a className="btn sm" href={api.portalEpisodeAudioUrl(e.id)} target="_blank" rel="noreferrer"><Icon name="download" size={12} /> Audio</a>}
                </div>
              </div>
              {e.hasVideo
                ? <video controls preload="none" style={{ width: '100%', marginTop: 10, borderRadius: 'var(--r-sm)', background: '#000' }} src={api.portalEpisodeVideoUrl(e.id)} />
                : e.hasAudio ? <audio controls preload="none" style={{ width: '100%', marginTop: 10 }} src={api.portalEpisodeAudioUrl(e.id)} /> : null}
            </div>
          ))}
        </div>}
    </div>
  );
}

// ---- Avatar looks ------------------------------------------------------
// Alternate photo/appearance options for an avatar, edited in HeyGen's own
// dashboard — same capability staff have via LookPicker in Studio/Brief,
// reusing its exact visual pattern but hitting the portal-scoped API.
function PortalLookPicker({ avatarId, currentLookId, onSet }) {
  const [looks, setLooks] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState('');
  const [zoom, setZoom] = React.useState(null);
  const [picking, setPicking] = React.useState(null);
  React.useEffect(() => {
    let live = true;
    api.portalAvatarLooks(avatarId)
      .then((r) => { if (live) setLooks((r && r.looks) || []); })
      .catch((e) => { if (live) setErr(e.message || 'Could not load looks.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [avatarId]);
  const pick = async (look) => {
    setErr(''); setPicking(look.id);
    try { await api.portalSetAvatarLook(avatarId, look.id, look.image_url); if (onSet) onSet(); }
    catch (e) { setErr(e.message); } finally { setPicking(null); }
  };
  if (loading) return <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 8 }}>Loading looks…</div>;
  if (err) return <div className="mono" style={{ color: 'var(--accent)', fontSize: 11, marginTop: 8 }}>{err}</div>;
  if (!looks || !looks.length) return <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 8 }}>No alternate looks available for this avatar yet.</div>;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {looks.map((l) => (
          <div key={l.id} style={{ position: 'relative', width: 56, height: 56 }}>
            <button onClick={() => pick(l)} disabled={picking === l.id} title={l.name || 'Use this look'}
              style={{ padding: 0, width: 56, height: 56, borderRadius: 6, overflow: 'hidden', cursor: picking === l.id ? 'wait' : 'pointer', background: 'var(--surface-2)',
                border: currentLookId === l.id ? '2px solid var(--accent)' : '1px solid var(--border)', opacity: picking === l.id ? 0.5 : 1 }}>
              {l.image_url ? <img src={l.image_url} alt={l.name || 'look'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icon name="avatars" size={16} />}
            </button>
            {l.image_url && (
              <button onClick={(e) => { e.stopPropagation(); setZoom({ url: l.image_url, name: l.name || 'Look' }); }} title="View full size"
                style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, padding: 0, display: 'grid', placeItems: 'center', borderRadius: 4, border: 'none', background: 'rgba(20,17,15,0.72)', color: '#fff', cursor: 'zoom-in' }}>
                <Icon name="search" size={11} />
              </button>
            )}
          </div>
        ))}
      </div>
      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.8)', display: 'grid', placeItems: 'center', padding: 24, zIndex: 200, cursor: 'zoom-out' }}>
          <img src={zoom.url} alt={zoom.name} style={{ maxWidth: '92vw', maxHeight: '92vh', borderRadius: 10, border: '1px solid var(--border)' }} />
        </div>
      )}
    </div>
  );
}

// ---- Avatars ---------------------------------------------------------------
function Avatars({ onChanged }) {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [note, setNote] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [openLooks, setOpenLooks] = React.useState(null); // avatar id whose picker is expanded
  const [refreshKey, setRefreshKey] = React.useState(0);
  React.useEffect(() => { api.portalAvatars().then(setData).catch((e) => setErr(e.message)); }, [refreshKey]);
  const request = async () => {
    if (!note.trim()) return;
    setBusy(true); setErr(''); setMsg('');
    try { await api.portalRequest('avatar', note.trim()); setNote(''); setMsg('Request sent — your producer will follow up.'); onChanged && onChanged(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const casts = data ? data.casts : [];
  const avatars = data ? (data.avatars || []) : [];
  return (
    <div className="fade-in">
      <SectionHead title="Avatars" sub="Your digital twins, their looks, and a place to ask for a new one." />
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      {!data ? <Empty>Loading…</Empty> : avatars.length > 0 && (
        <div className="col" style={{ gap: 8, marginBottom: 16 }}>
          <div className="label">YOUR AVATARS</div>
          {avatars.map((a) => (
            <div key={a.id} style={{ ...card }}>
              <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 6, overflow: 'hidden', background: 'var(--surface-2)', flexShrink: 0 }}>
                    {a.thumbnail_url ? <img src={a.thumbnail_url} alt={a.name || 'avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}><Icon name="avatars" size={16} /></div>}
                  </div>
                  <strong style={{ fontSize: 14 }}>{a.name || `Avatar ${a.id}`}</strong>
                </div>
                {a.heygen_group_id && (
                  <button className="btn sm" onClick={() => setOpenLooks(openLooks === a.id ? null : a.id)}>
                    {openLooks === a.id ? 'Hide looks' : 'Change look'}
                  </button>
                )}
              </div>
              {openLooks === a.id && (
                <PortalLookPicker avatarId={a.id} currentLookId={a.heygen_avatar_id} onSet={() => { setOpenLooks(null); setRefreshKey((k) => k + 1); }} />
              )}
            </div>
          ))}
        </div>
      )}
      <div style={{ ...card, marginBottom: 16 }}>
        <div className="label">REQUEST A NEW / ADDITIONAL AVATAR</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Tell us what you have in mind — a new look, a second presenter, wardrobe, setting, anything." style={{ ...inputStyle, resize: 'vertical', marginTop: 10 }} />
        <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button className="btn primary sm" disabled={busy || !note.trim()} onClick={request}><Icon name="plus" size={12} /> Send request</button>
          {msg && <span className="mono" style={{ color: 'var(--ok)', fontSize: 12 }}>{msg}</span>}
        </div>
      </div>
      {!data ? null
        : casts.length === 0 ? <Empty>No avatar renders yet.{data.recordings ? ` (${data.recordings} recording${data.recordings === 1 ? '' : 's'} captured.)` : ''}</Empty>
        : <div className="col" style={{ gap: 8 }}>
          <div className="label">RENDERS</div>
          {casts.map((v) => (
            <div key={v.id} className="row" style={{ ...card, justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 14 }}>{v.title}</strong>
              <span className="mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>{String(v.status).replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>}
    </div>
  );
}

// ---- Topic Suggestions -----------------------------------------------------
function Topics() {
  const [topics, setTopics] = React.useState(null);
  const [text, setText] = React.useState('');
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const load = () => api.portalTopics().then((r) => setTopics(r.topics || [])).catch((e) => setErr(e.message));
  React.useEffect(() => { load(); }, []);
  const add = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr('');
    try { await api.portalAddTopic(text.trim()); setText(''); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="fade-in">
      <SectionHead title="Topic suggestions" sub="Ideas you'd like us to turn into content. Add as many as you like." />
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      <div style={{ ...card, marginBottom: 16 }}>
        <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="Suggest a topic…" style={{ ...inputStyle, flex: 1 }} />
          <button className="btn primary" disabled={busy || !text.trim()} onClick={add}><Icon name="plus" size={13} /> Add</button>
        </div>
      </div>
      {!topics ? <Empty>Loading…</Empty>
        : topics.length === 0 ? <Empty>No topics yet — add your first above.</Empty>
        : <div className="col" style={{ gap: 8 }}>
          {topics.map((t) => (
            <div key={t.id} style={{ ...card }}>
              <div style={{ fontSize: 14 }}>{t.text}</div>
              {t.created_at && <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 4 }}>added {String(t.created_at).slice(0, 10)}</div>}
            </div>
          ))}
        </div>}
    </div>
  );
}

// ---- Account ---------------------------------------------------------------
function Account() {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [q, setQ] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [pw, setPw] = React.useState({ current: '', next: '', confirm: '' });
  const [pwErr, setPwErr] = React.useState('');
  const [pwMsg, setPwMsg] = React.useState('');
  const [pwBusy, setPwBusy] = React.useState(false);
  React.useEffect(() => { api.portalAccount().then(setData).catch((e) => setErr(e.message)); }, []);
  const send = async () => {
    if (!q.trim()) return;
    setBusy(true); setErr(''); setMsg('');
    try { await api.portalRequest('question', q.trim()); setQ(''); setMsg('Sent — we’ll be in touch.'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const changePassword = async () => {
    setPwErr(''); setPwMsg('');
    if (pw.next.length < 6) { setPwErr('New password must be at least 6 characters.'); return; }
    if (pw.next !== pw.confirm) { setPwErr('New passwords don’t match.'); return; }
    setPwBusy(true);
    try {
      await api.changeMyPassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg('Password updated.');
    } catch (e) { setPwErr(e.message); } finally { setPwBusy(false); }
  };
  const contact = data ? data.contact : {};
  const Row = ({ k, v }) => (
    <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
      <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>{k}</span>
      <span style={{ fontSize: 13 }}>{v || <span style={{ color: 'var(--text-4)' }}>—</span>}</span>
    </div>
  );
  return (
    <div className="fade-in">
      <SectionHead title="Account" sub={data ? data.client.name : ''} />
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      <div style={{ ...card, marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 4 }}>CONTACT ON FILE</div>
        <Row k="Email" v={contact.email} />
        <Row k="Phone" v={contact.phone} />
        <Row k="Mobile" v={contact.mobile} />
        <Row k="Website" v={contact.website} />
        <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 8 }}>Need a change? Send us a note below.</div>
      </div>
      <div style={{ ...card, marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 10 }}>CHANGE PASSWORD</div>
        <div className="col" style={{ gap: 8, maxWidth: 320 }}>
          <input type="password" placeholder="Current password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} style={inputStyle} />
          <input type="password" placeholder="New password (min 6)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} style={inputStyle} />
          <input type="password" placeholder="Confirm new password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} style={inputStyle} />
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 10 }}>
          <button className="btn primary sm" disabled={pwBusy || !pw.current || !pw.next || !pw.confirm} onClick={changePassword}>Update password</button>
          {pwMsg && <span className="mono" style={{ color: 'var(--ok)', fontSize: 12 }}>{pwMsg}</span>}
          {pwErr && <span className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>{pwErr}</span>}
        </div>
      </div>
      <div style={{ ...card }}>
        <div className="label">CONTACT / QUESTION</div>
        <textarea value={q} onChange={(e) => setQ(e.target.value)} rows={4} placeholder="Ask us anything, or request a change to your details." style={{ ...inputStyle, resize: 'vertical', marginTop: 10 }} />
        <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button className="btn primary sm" disabled={busy || !q.trim()} onClick={send}><Icon name="send" size={12} /> Send</button>
          {msg && <span className="mono" style={{ color: 'var(--ok)', fontSize: 12 }}>{msg}</span>}
        </div>
      </div>
    </div>
  );
}

// ---- Onboarding (client-side checklist) ------------------------------------
// Same data staff keep on the Brief — edits here show there and vice versa.
// Passwords are write-only: you can set one, but it's never shown back.
const ACCOUNT_PICKS = [
  ['social', 'Facebook'], ['social', 'Instagram'], ['social', 'LinkedIn'], ['social', 'TikTok'],
  ['social', 'X (Twitter)'], ['social', 'Pinterest'], ['website', 'Website admin'], ['website', 'Hosting provider'],
  ['website', 'Domain registrar'], ['other', 'Google Business Profile'], ['other', 'Google account'],
  ['other', 'Bing Places'], ['other', 'Yelp'],
];
const EMPTY_ACCT = { kind: 'social', platform: '', url: '', username: '', secret: '', notes: '' };

function Onboarding() {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [contact, setContact] = React.useState({ email: '', phone: '', mobile: '', address: '', website: '' });
  const [contactMsg, setContactMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_ACCT);
  const [edit, setEdit] = React.useState(null);
  const [ytBusy, setYtBusy] = React.useState(false);
  const [metaBusy, setMetaBusy] = React.useState(false);

  const load = React.useCallback(() => api.portalOnboarding()
    .then((d) => { setData(d); setContact(d.contact); })
    .catch((e) => setErr(e.message || 'Could not load your onboarding.')), []);
  React.useEffect(() => { load(); }, [load]);

  const saveContact = async () => {
    setBusy(true); setErr(''); setContactMsg('');
    try { await api.portalSaveContact(contact); setContactMsg('Saved.'); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const addAccount = async () => {
    if (!form.platform.trim()) { setErr('Enter the platform (e.g. Instagram).'); return; }
    setBusy(true); setErr('');
    try { await api.portalAddAccount(form); setForm(EMPTY_ACCT); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const saveEdit = async () => {
    if (!edit.platform.trim()) { setErr('Enter the platform (e.g. Instagram).'); return; }
    setBusy(true); setErr('');
    try { await api.portalUpdateAccount(edit.id, { kind: edit.kind, platform: edit.platform, url: edit.url, username: edit.username, notes: edit.notes, ...(edit.secret ? { secret: edit.secret } : {}) }); setEdit(null); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const remove = async (id) => {
    if (!window.confirm('Remove this account from your list?')) return;
    setErr('');
    try { await api.portalDeleteAccount(id); await load(); } catch (e) { setErr(e.message); }
  };
  const connectYoutube = async () => {
    setYtBusy(true); setErr('');
    try { const { url } = await api.portalYoutubeLink(); window.location.href = url; }
    catch (e) { setErr(e.message); setYtBusy(false); }
  };
  const connectMeta = async () => {
    setMetaBusy(true); setErr('');
    try { const { url } = await api.portalMetaLink(); window.location.href = url; }
    catch (e) { setErr(e.message); setMetaBusy(false); }
  };
  const [channelBusy, setChannelBusy] = React.useState('');
  const connectChannel = async (key) => {
    setChannelBusy(key); setErr('');
    try { const { url } = await api.portalChannelLink(key); window.location.href = url; }
    catch (e) { setErr(e.message); setChannelBusy(''); }
  };
  const pick = (i) => {
    if (i === '') return;
    const [kind, platform] = ACCOUNT_PICKS[Number(i)];
    setForm((f) => ({ ...f, kind, platform }));
  };

  if (!data) return <div className="fade-in"><SectionHead title="Onboarding" />{err ? <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div> : <Empty>Loading…</Empty>}</div>;

  const doneCount = data.steps.filter((x) => x.done).length;
  const yt = data.youtube;
  const meta = data.meta;
  const F = ({ label, k, type = 'text', ph }) => (
    <div style={{ flex: '1 1 220px' }}>
      <div className="label" style={{ marginBottom: 4 }}>{label}</div>
      <input type={type} value={contact[k] || ''} placeholder={ph} onChange={(e) => { setContact({ ...contact, [k]: e.target.value }); setContactMsg(''); }} style={inputStyle} />
    </div>
  );

  return (
    <div className="fade-in">
      <SectionHead title="Onboarding" sub={`${doneCount} of ${data.steps.length} steps done — this is the same information your producer keeps on file.`} />
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}

      <div style={{ ...card, marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 8 }}>YOUR CHECKLIST</div>
        {data.steps.map((x) => (
          <div key={x.key} className="row" style={{ gap: 10, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: x.done ? 'var(--ok)' : 'var(--text-4)', width: 16 }}>{x.done ? '✓' : '○'}</span>
            <span style={{ fontSize: 13.5, color: x.done ? 'var(--text-3)' : 'var(--text)' }}>{x.label}</span>
          </div>
        ))}
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 4 }}>CONNECT YOUTUBE</div>
        <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
          Sign in to Google yourself and approve publishing to your channel — we never need your password or owner access, and you can disconnect at any time.
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          {yt.connected === true
            ? <span className="mono" style={{ color: 'var(--ok)', fontSize: 13 }}>✓ YouTube is connected</span>
            : <button className="btn primary sm" disabled={ytBusy} onClick={connectYoutube}>{ytBusy ? 'Opening…' : 'Connect YouTube'}</button>}
          {yt.connected === true && <button className="btn sm" disabled={ytBusy} onClick={connectYoutube}>Reconnect</button>}
          {yt.connected === null && <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>Couldn’t check the connection just now.</span>}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 4 }}>CONNECT FACEBOOK &amp; INSTAGRAM</div>
        <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
          Sign in yourself and approve publishing to your Page and Instagram account — we never need your password or owner access. One sign-in connects both.
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          {(meta.facebook || meta.instagram)
            ? <span className="mono" style={{ color: 'var(--ok)', fontSize: 13 }}>
                ✓ {meta.facebook && meta.instagram ? 'Facebook & Instagram are connected' : meta.facebook ? 'Facebook is connected · Instagram not yet' : 'Instagram is connected · Facebook not yet'}
              </span>
            : <button className="btn primary sm" disabled={metaBusy} onClick={connectMeta}>{metaBusy ? 'Opening…' : 'Connect Facebook & Instagram'}</button>}
          {(meta.facebook || meta.instagram) && <button className="btn sm" disabled={metaBusy} onClick={connectMeta}>{meta.facebook && meta.instagram ? 'Reconnect' : 'Connect the other one'}</button>}
          {meta.facebook === null && <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>Couldn’t check the connection just now.</span>}
        </div>
      </div>

      {[['tiktok', 'TikTok'], ['linkedin', 'LinkedIn'], ['x', 'X (Twitter)'], ['threads', 'Threads'], ['google_business', 'Google Business']].map(([k, label]) => {
        const st = (data.channels || {})[k] || {};
        return (
          <div key={k} style={{ ...card, marginBottom: 16 }}>
            <div className="label" style={{ marginBottom: 4 }}>CONNECT {label.toUpperCase()}</div>
            <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
              Sign in yourself and approve publishing — we never need your password or owner access, and you can disconnect at any time.
            </div>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              {st.connected === true
                ? <span className="mono" style={{ color: 'var(--ok)', fontSize: 13 }}>✓ {label} is connected</span>
                : <button className="btn primary sm" disabled={channelBusy === k} onClick={() => connectChannel(k)}>{channelBusy === k ? 'Opening…' : `Connect ${label}`}</button>}
              {st.connected === true && <button className="btn sm" disabled={channelBusy === k} onClick={() => connectChannel(k)}>Reconnect</button>}
              {st.connected === null && <span className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>Couldn’t check the connection just now.</span>}
            </div>
          </div>
        );
      })}

      <div style={{ ...card, marginBottom: 16 }}>
        <div className="label" style={{ marginBottom: 4 }}>CONTACT &amp; SCRIPT DETAILS</div>
        <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12.5, marginBottom: 10 }}>Used in your scripts and to reach you — keep them current.</div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <F label="EMAIL" k="email" type="email" />
          <F label="PHONE" k="phone" />
          <F label="MOBILE" k="mobile" />
          <F label="WEBSITE" k="website" ph="https://" />
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="label" style={{ marginBottom: 4 }}>ADDRESS</div>
          <textarea rows={2} value={contact.address || ''} onChange={(e) => { setContact({ ...contact, address: e.target.value }); setContactMsg(''); }} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div className="row" style={{ gap: 10, alignItems: 'center', marginTop: 10 }}>
          <button className="btn primary sm" disabled={busy} onClick={saveContact}>Save details</button>
          {contactMsg && <span className="mono" style={{ color: 'var(--ok)', fontSize: 12 }}>{contactMsg}</span>}
        </div>
      </div>

      <div style={card}>
        <div className="label" style={{ marginBottom: 4 }}>YOUR ACCOUNTS · social, website, Google</div>
        <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12.5, marginBottom: 10 }}>Passwords are stored encrypted and never shown back to you — leave blank to keep the current one.</div>
        {data.accounts.length === 0 && <Empty>No accounts added yet.</Empty>}
        {data.accounts.map((a) => (edit && edit.id === a.id ? (
          <div key={a.id} className="col" style={{ gap: 8, borderTop: '1px solid var(--border)', padding: '10px 0' }}>
            <input placeholder="Platform" value={edit.platform} onChange={(e) => setEdit({ ...edit, platform: e.target.value })} style={inputStyle} />
            <input placeholder="URL" value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} style={inputStyle} />
            <input placeholder="Handle / username / login" value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} style={inputStyle} />
            <input type="password" placeholder="New password (leave blank to keep)" autoComplete="new-password" value={edit.secret} onChange={(e) => setEdit({ ...edit, secret: e.target.value })} style={inputStyle} />
            <input placeholder="Notes" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} style={inputStyle} />
            <div className="row" style={{ gap: 6 }}>
              <button className="btn primary sm" disabled={busy} onClick={saveEdit}>Save</button>
              <button className="btn sm" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div key={a.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTop: '1px solid var(--border)', padding: '8px 0' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.platform} <span className="mono" style={{ color: 'var(--text-4)', fontWeight: 400, fontSize: 11 }}>{a.kind}</span></div>
              {a.url && <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.url}</div>}
              {a.username && <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>{a.username}{a.hasSecret ? ' · password saved' : ''}</div>}
            </div>
            <div className="row" style={{ gap: 6, flex: 'none' }}>
              <button className="btn sm" onClick={() => setEdit({ id: a.id, kind: a.kind, platform: a.platform || '', url: a.url || '', username: a.username || '', notes: a.notes || '', secret: '' })}>Edit</button>
              <button className="btn sm" onClick={() => remove(a.id)}>Remove</button>
            </div>
          </div>
        )))}
        <div className="col" style={{ gap: 8, marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <div className="label">ADD AN ACCOUNT</div>
          <select value="" onChange={(e) => pick(e.target.value)} style={inputStyle}>
            <option value="">Quick pick…</option>
            {ACCOUNT_PICKS.map(([k, p], i) => <option key={p} value={i}>{p}</option>)}
          </select>
          <input placeholder="Platform (e.g. Instagram)" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} style={inputStyle} />
          <input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} style={inputStyle} />
          <input placeholder="Handle / username / login" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={inputStyle} />
          <input type="password" placeholder="Password (optional, stored encrypted)" autoComplete="new-password" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} style={inputStyle} />
          <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={inputStyle} />
          <div><button className="btn primary sm" disabled={busy || !form.platform.trim()} onClick={addAccount}>Add account</button></div>
        </div>
      </div>
    </div>
  );
}

// ---- Help ------------------------------------------------------------------
function Help() {
  return (
    <div className="fade-in">
      <SectionHead title="Help" sub="A quick guide to your portal." />
      <div style={{ ...card }}>
        <p style={{ marginTop: 0 }}><strong>Needs Approval</strong> — anything we’ve sent for your sign-off. Approve it, or use <em>Request changes</em> to tell us what to adjust.</p>
        <p><strong>In Production</strong> — items you’ve approved that we’re now producing.</p>
        <p><strong>Past Episodes</strong> — your finished pieces, ready to play or download.</p>
        <p><strong>Avatars</strong> — your digital-twin renders, plus a button to request a new or additional avatar.</p>
        <p><strong>Topic Suggestions</strong> — drop in ideas any time; they feed straight into our planning.</p>
        <p><strong>Account</strong> — your contact details, and a form to send us a question.</p>
        <p style={{ marginBottom: 0, color: 'var(--text-3)' }}>Questions we haven’t covered? Use the contact form on the Account page and we’ll get back to you.</p>
      </div>
    </div>
  );
}


// ---- Agreement (read-only signed contract) --------------------------------
function ContractSection({ title, body }) {
  if (!body || !String(body).trim()) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div className="label" style={{ marginBottom: 4 }}>{title}</div>
      <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text-2)' }}>{body}</div>
    </div>
  );
}
function Contract() {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  React.useEffect(() => { api.portalContract().then(setData).catch((e) => setErr(e.message)); }, []);
  return (
    <div className="fade-in">
      <SectionHead title="Your agreement" sub="Your signed cue:cast service agreement." />
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      {!data ? <Empty>Loading…</Empty>
        : !data.exists ? <Empty>No signed agreement on file yet. Once you sign, your copy appears here.</Empty>
        : (
          <div style={card}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 18 }}>{data.service_name || 'cue:cast'}</strong>
              {data.cost && <span className="mono" style={{ color: 'var(--accent)', fontSize: 16, fontWeight: 700 }}>{data.cost}</span>}
            </div>
            {data.summary && <div className="mono" style={{ color: 'var(--text-3)', fontSize: 13, marginTop: 4 }}>{data.summary}</div>}
            <ContractSection title="TERMS" body={data.terms} />
            <ContractSection title="BILLING" body={data.billing} />
            <ContractSection title="ADDITIONAL TERMS" body={data.extra} />
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 16, paddingTop: 12 }}>
              <div className="mono" style={{ fontSize: 12, color: 'var(--ok)' }}>
                ✓ Signed by {data.signer_name}{data.signer_title ? (', ' + data.signer_title) : ''}{data.signed_at ? (' · ' + String(data.signed_at).slice(0, 16).replace('T', ' ')) : ''}
              </div>
              {data.agency_signed_by && <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Countersigned by {data.agency_signed_by} (cue:creative)</div>}
              <a className="btn sm" style={{ marginTop: 12 }} href={api.portalContractPdfUrl()} target="_blank" rel="noreferrer"><Icon name="download" size={12} /> Download PDF</a>
            </div>
          </div>
        )}
    </div>
  );
}

// ---- Shell -----------------------------------------------------------------
export default function PortalApp({ me }) {
  const [view, setView] = React.useState(() => (typeof window !== 'undefined' && window.location.hash === '#onboarding' ? 'onboarding' : 'approve'));
  const [summary, setSummary] = React.useState(null);
  const refreshSummary = React.useCallback(() => { api.portalSummary().then(setSummary).catch(() => {}); }, []);
  React.useEffect(() => { refreshSummary(); }, [refreshSummary]);
  const logout = async () => { try { await api.logout(); } catch { /* ignore */ } window.location.href = '/login.html'; };

  const counts = summary ? summary.counts : {};
  const clientName = summary ? summary.client.name : '';

  return (
    <div className="row portal-shell" style={{ height: '100vh', alignItems: 'stretch', background: 'var(--bg)', color: 'var(--text)', overflow: 'hidden' }}>
      <aside className="portal-aside" style={{ width: 232, flex: 'none', borderRight: '1px solid var(--border)', padding: 18, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--surface)', overflowY: 'auto', minHeight: 0 }}>
        <div style={{ padding: '4px 6px 14px' }}>
          <img src={cuecastLogo} alt="cue:cast" style={{ height: 26, width: 'auto', maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
          {clientName && <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 6 }}>{clientName}</div>}
        </div>
        {MENU.map((m) => {
          const active = view === m.id;
          const badge = m.badge ? counts[m.badge] : 0;
          return (
            <button key={m.id} onClick={() => setView(m.id)} className="row" style={{
              gap: 10, alignItems: 'center', width: '100%', textAlign: 'left', cursor: 'pointer',
              background: active ? 'var(--surface-2)' : 'transparent', color: active ? 'var(--text)' : 'var(--text-3)',
              border: '1px solid ' + (active ? 'var(--border)' : 'transparent'), borderRadius: 'var(--r-sm)', padding: '9px 10px', fontSize: 13.5,
            }}>
              <Icon name={m.icon} size={15} />
              <span style={{ flex: 1 }}>{m.label}</span>
              {badge ? <span className="badge" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>{badge}</span> : null}
            </button>
          );
        })}
        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
          <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginBottom: 6 }}>{me ? me.username : ''}</div>
          <button className="btn sm" style={{ width: '100%' }} onClick={logout}>Log out</button>
        </div>
      </aside>
      <main className="portal-main" style={{ flex: 1, padding: '26px 30px', maxWidth: 860, margin: '0 auto', width: '100%', overflowY: 'auto', minHeight: 0 }}>
        {view === 'approve' && <NeedsApproval onChanged={refreshSummary} />}
        {view === 'onboarding' && <Onboarding />}
        {view === 'production' && <InProduction />}
        {view === 'episodes' && <PastEpisodes />}
        {view === 'avatars' && <Avatars onChanged={refreshSummary} />}
        {view === 'topics' && <Topics />}
        {view === 'contract' && <Contract />}
        {view === 'account' && <Account />}
        {view === 'help' && <Help />}
      </main>
    </div>
  );
}
