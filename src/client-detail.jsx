import React, { useState, useEffect } from 'react'
import { api, API_BASE } from './api.js'
import { Icon } from './shared.jsx'
import { BriefView } from './brief.jsx'
import { RecordingsView } from './recordings.jsx'
import { EpisodesView } from './episodes.jsx'

const TABS = [
  { id: 'brief',      label: 'Brief',      icon: 'doc' },
  { id: 'recordings', label: 'Recordings', icon: 'play' },
  { id: 'scripts',    label: 'Scripts',    icon: 'doc' },
  { id: 'invites',    label: 'Invites',    icon: 'send' },
  { id: 'episodes',   label: 'Episodes',   icon: 'history' },
];

function fmtDate(s) {
  if (!s) return '—';
  return String(s).slice(0, 10);
}

// Duplicated from scripts.jsx (no shared module between these views) —
// change one, change both.
const typePrefix = (channel, variant) => {
  if (channel === 'shortform') return 'SF' + (variant || 1);
  if (channel === 'longform') return 'LF';
  if (channel === 'tvradio') return 'TV' + (variant || 1);
  if (channel === 'blog') return 'Blog';
  return (channel || '—').slice(0, 2).toUpperCase();
};

function ScriptsSection({ clientId }) {
  const [scripts, setScripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    setLoading(true); setErr('');
    api.listScripts(clientId)
      .then((s) => setScripts(Array.isArray(s) ? s : (s.scripts || [])))
      .catch((e) => setErr(e.message || 'Could not load scripts.'))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return <div className="mono" style={{ color: 'var(--text-3)' }}>Loading scripts…</div>;
  if (err) return <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>;
  if (scripts.length === 0) return <div className="mono" style={{ color: 'var(--text-3)' }}>No scripts generated for this client yet.</div>;

  return (
    <div className="col" style={{ gap: 8 }}>
      {scripts.map((s) => (
        <div key={s.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                <span className="mono" style={{ color: 'var(--text-4)', fontWeight: 400 }}>{typePrefix(s.channel, s.variant)}: </span>
                {(s.title && s.title.trim()) || (s.topic && s.topic.trim()) || 'Untitled'}
              </div>
              {s.description && (
                <div className="mono" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-3)', marginTop: 3 }}>{s.description}</div>
              )}
              <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>
                {fmtDate(s.created_at)}{s.model ? ` · ${s.model}` : ''}{s.status ? ` · ${s.status}` : ''}
              </div>
            </div>
            <button className="btn sm" onClick={() => setOpenId(openId === s.id ? null : s.id)}>{openId === s.id ? 'Hide' : 'View'}</button>
          </div>
          {openId === s.id && (
            <div className="mono" style={{ whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-2)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              {s.body || '(empty)'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function InvitesSection({ clientId }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(null);
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(7);
  const [mode, setMode] = useState('video');
  const [kind, setKind] = useState('record');
  const [creating, setCreating] = useState(false);
  const [note, setNote] = useState('');

  const load = () => {
    setLoading(true); setErr('');
    return api.listClientInvites(clientId)
      .then((r) => {
        const list = Array.isArray(r) ? r : (r.invites || []);
        setInvites(list);
        // Best-effort: flip completed invites to "recorded" from Railway status.
        const pending = list.filter((i) => i.token && (!i.status || i.status === 'pending'));
        if (pending.length) {
          Promise.all(
            pending.map((i) =>
              fetch(API_BASE + '/api/invitations/' + encodeURIComponent(i.token) + '/status')
                .then((res2) => (res2.ok ? res2.json() : null))
                .then((d) => (d && d.status === 'completed' ? i.token : null))
                .catch(() => null)
            )
          ).then((tokens) => {
            const done = new Set(tokens.filter(Boolean));
            if (done.size) {
              setInvites((cur) => cur.map((i) => (done.has(i.token) ? { ...i, status: 'recorded' } : i)));
            }
          });
        }
      })
      .catch((e) => setErr(e.message || 'Could not load invites.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [clientId]);

  const create = async () => {
    setCreating(true); setErr('');
    try {
      const r = await api.createInvite(clientId, { clientEmail: email.trim() || null, label: label.trim() || null, days: Number(days) || 7, mode, kind });
      if (r && r.email && r.email.sent) setNote('Invite created and emailed.');
      else if (r && r.email && r.email.skipped) setNote('Invite created. No email address given — use Copy link to send it.');
      else setNote('Invite created, but the email did NOT send: ' + ((r && r.email && r.email.error) || 'unknown error') + ' — use Copy link to send it manually.');
      setEmail(''); setLabel('');
      await load();
    } catch (e) { setErr(e.message || 'Could not create invite.'); } finally { setCreating(false); }
  };

  const copyLink = async (token) => {
    const url = 'https://record.cuecreative.com/record.html?token=' + encodeURIComponent(token);
    try { await navigator.clipboard.writeText(url); setCopied(token); setTimeout(() => setCopied(null), 1500); }
    catch { setErr('Could not copy to clipboard.'); }
  };

  const remove = async (inv) => {
    if (!window.confirm(`Delete this invite${inv.label ? ` — "${inv.label}"` : ''}? This can't be undone.`)) return;
    try { await api.deleteInvite(clientId, inv.id); await load(); }
    catch (e) { setErr(e.message || 'Could not delete invite.'); }
  };

  const inputStyle = {
    background: 'var(--surface-2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px', height: 40,
    boxSizing: 'border-box',
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="card card-pad">
        <div className="label" style={{ marginBottom: 10 }}>NEW INVITE</div>
        <div className="col" style={{ gap: 8 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Client email (optional)" style={{ ...inputStyle, width: '100%' }} />
          <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (e.g. CEO avatar)" style={{ ...inputStyle, flex: 1 }} />
            <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...inputStyle, width: 190 }}>
              <option value="record">Record digital twin</option>
              <option value="onboarding">Onboarding form</option>
            </select>
            {kind === 'record' && (
              <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ ...inputStyle, width: 150 }}>
                <option value="video">Image avatar</option>
                <option value="voice">Voice only</option>
              </select>
            )}
            <select value={days} onChange={(e) => setDays(e.target.value)} style={{ ...inputStyle, width: 90 }}>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
            <button className="btn primary" onClick={create} disabled={creating}>
              <Icon name="send" size={13} />
              {creating ? 'Creating…' : 'Create invite'}
            </button>
          </div>
          <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11 }}>
            Creates a record link for this client. If an email is provided, it's sent automatically.
            {' '}Image avatar records camera and microphone; voice only records the microphone alone.
          </div>
        </div>
      </div>

      {err && <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>}
      {note && (
        <div className="card card-pad mono" style={{ fontSize: 12, color: note.includes('did NOT send') ? 'var(--accent)' : 'var(--text-2)', borderColor: note.includes('did NOT send') ? 'var(--accent)' : 'var(--border)' }}>
          {note}
          <button className="btn sm ghost" style={{ marginLeft: 10 }} onClick={() => setNote('')}>Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>Loading invites…</div>
      ) : invites.length === 0 ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>No invites for this client yet.</div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {invites.map((inv) => (
            <div key={inv.id} className="card card-pad row" style={{ gap: 12, alignItems: 'center' }}>
              <Icon name="send" size={16} style={{ color: 'var(--text-3)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{inv.label || inv.client_email || 'Invite'}</div>
                <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inv.token} · created {fmtDate(inv.created_at)} · expires {fmtDate(inv.expires_at)}
                </div>
              </div>
              <span className="badge">{inv.kind === 'onboarding' ? 'onboarding' : (inv.mode === 'voice' ? 'voice only' : 'image avatar')}</span>
              <span className="badge">{inv.status || 'pending'}{inv.sent_at ? ' · sent ' + String(inv.sent_at).slice(0, 10) : ''}</span>
              <button className="btn sm" onClick={() => copyLink(inv.token)}>
                <Icon name="send" size={13} />
                {copied === inv.token ? 'Copied' : 'Copy link'}
              </button>
              <button className="btn sm" onClick={() => remove(inv)} style={{ color: 'var(--accent)' }}>
                <Icon name="close" size={13} /> Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientDetailView({ client, onBack, onOpenStudio, onCastScript, onSendTopicToScripts }) {
  const [tab, setTab] = useState('brief');
  const [episodeRequest, setEpisodeRequest] = useState(null);
  if (!client) {
    return (
      <div className="v-pad">
        <button className="btn sm" onClick={onBack}>← Back to clients</button>
        <div className="mono" style={{ color: 'var(--text-3)', marginTop: 12 }}>No client selected.</div>
      </div>
    );
  }

  return (
    <div className="v-pad fade-in">
      <button className="btn sm" onClick={onBack} style={{ marginBottom: 14 }}>← Back to clients</button>

      <div className="label">CLIENT WORKSPACE · {client.id}</div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 32, lineHeight: 1.1, margin: '6px 0 16px' }}>
        {client.name}
      </h1>

      <div className="row" style={{ gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.id} className={'btn sm' + (tab === t.id ? ' primary' : '')} onClick={() => setTab(t.id)}>
            <Icon name={t.icon} size={13} /> {t.label}
          </button>
        ))}
        {onOpenStudio && (
          <button className="btn sm" style={{ marginLeft: 'auto', borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={() => onOpenStudio(client.id)}>
            <Icon name="sparkle" size={13} /> Studio
          </button>
        )}
      </div>

      {tab === 'brief' && <BriefView clientId={client.id} onSendTopicToScripts={onSendTopicToScripts} />}
      {tab === 'recordings' && <RecordingsView activeClientId={client.id} onCreateEpisode={(req) => { setEpisodeRequest(req); setTab('episodes'); }} onCastScript={onCastScript} />}
      {tab === 'scripts' && <ScriptsSection clientId={client.id} />}
      {tab === 'invites' && <InvitesSection clientId={client.id} />}
      {tab === 'episodes' && <EpisodesView activeClientId={client.id} episodeRequest={episodeRequest} onEpisodeRequestConsumed={() => setEpisodeRequest(null)} />}
    </div>
  );
}

export { ClientDetailView }
