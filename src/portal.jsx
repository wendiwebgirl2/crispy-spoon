import React from 'react'
import { Icon } from './shared.jsx'
import { api } from './api.js'

// Client-facing portal (Slice 14). A separate shell from the staff dashboard,
// shown when the signed-in account has role='client'. Everything it reads/writes
// is scoped server-side to the one client the account belongs to (/api/portal/*).

const MENU = [
  { id: 'approve', label: 'Needs Approval', icon: 'check', badge: 'needsApproval' },
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

// ---- Avatars ---------------------------------------------------------------
function Avatars({ onChanged }) {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [note, setNote] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { api.portalAvatars().then(setData).catch((e) => setErr(e.message)); }, []);
  const request = async () => {
    if (!note.trim()) return;
    setBusy(true); setErr(''); setMsg('');
    try { await api.portalRequest('avatar', note.trim()); setNote(''); setMsg('Request sent — your producer will follow up.'); onChanged && onChanged(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const casts = data ? data.casts : [];
  return (
    <div className="fade-in">
      <SectionHead title="Avatars" sub="Your digital-twin renders, and a place to ask for a new one." />
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 10 }}>{err}</div>}
      <div style={{ ...card, marginBottom: 16 }}>
        <div className="label">REQUEST A NEW / ADDITIONAL AVATAR</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Tell us what you have in mind — a new look, a second presenter, wardrobe, setting, anything." style={{ ...inputStyle, resize: 'vertical', marginTop: 10 }} />
        <div className="row" style={{ gap: 8, alignItems: 'center', marginTop: 8 }}>
          <button className="btn primary sm" disabled={busy || !note.trim()} onClick={request}><Icon name="plus" size={12} /> Send request</button>
          {msg && <span className="mono" style={{ color: 'var(--ok)', fontSize: 12 }}>{msg}</span>}
        </div>
      </div>
      {!data ? <Empty>Loading…</Empty>
        : casts.length === 0 ? <Empty>No avatar renders yet.{data.recordings ? ` (${data.recordings} recording${data.recordings === 1 ? '' : 's'} captured.)` : ''}</Empty>
        : <div className="col" style={{ gap: 8 }}>
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
  React.useEffect(() => { api.portalAccount().then(setData).catch((e) => setErr(e.message)); }, []);
  const send = async () => {
    if (!q.trim()) return;
    setBusy(true); setErr(''); setMsg('');
    try { await api.portalRequest('question', q.trim()); setQ(''); setMsg('Sent — we’ll be in touch.'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
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
  const [view, setView] = React.useState('approve');
  const [summary, setSummary] = React.useState(null);
  const refreshSummary = React.useCallback(() => { api.portalSummary().then(setSummary).catch(() => {}); }, []);
  React.useEffect(() => { refreshSummary(); }, [refreshSummary]);
  const logout = async () => { try { await api.logout(); } catch { /* ignore */ } window.location.href = '/login.html'; };

  const counts = summary ? summary.counts : {};
  const clientName = summary ? summary.client.name : '';

  return (
    <div className="row" style={{ minHeight: '100vh', alignItems: 'stretch', background: 'var(--bg)', color: 'var(--text)' }}>
      <aside style={{ width: 232, borderRight: '1px solid var(--border)', padding: 18, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--surface)' }}>
        <div style={{ padding: '4px 6px 14px' }}>
          <div style={{ fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 20 }}>cue<span style={{ color: 'var(--accent)' }}>:</span>portal</div>
          {clientName && <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>{clientName}</div>}
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
      <main style={{ flex: 1, padding: '26px 30px', maxWidth: 860, margin: '0 auto', width: '100%' }}>
        {view === 'approve' && <NeedsApproval onChanged={refreshSummary} />}
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
