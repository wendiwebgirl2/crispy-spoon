import React, { useState, useEffect } from 'react'
import { api } from './api.js'
import { Icon } from './shared.jsx'
import { BriefView } from './brief.jsx'
import { RecordingsView } from './recordings.jsx'

// Client workspace — a detail page that replaces the client list. An internal
// tab strip groups everything about one client: brief, recordings + renders,
// script history, invites/tokens, and (once Planner ships) completed episodes.
// Brief and Recordings are reused wholesale; the rest are read-only sections.

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

// —— Scripts history ————————————————————————————————————————————————
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
            <span className="badge">{s.channel || 'script'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.topic || 'Untitled'}</div>
              <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2 }}>
                {fmtDate(s.created_at)}{s.model ? ` · ${s.model}` : ''}{s.status ? ` · ${s.status}` : ''}
              </div>
            </div>
            <button className="btn sm" onClick={() => setOpenId(openId === s.id ? null : s.id)}>
              {openId === s.id ? 'Hide' : 'View'}
            </button>
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

// —— Invites / tokens ———————————————————————————————————————————————
function InvitesSection({ clientId }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(null);
  // create form
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(7);
  const [creating, setCreating] = useState(false);

  const load = () => {
    setLoading(true); setErr('');
    return api.listClientInvites(clientId)
      .then((r) => setInvites(Array.isArray(r) ? r : (r.invites || [])))
      .catch((e) => setErr(e.message || 'Could not load invites.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [clientId]);

  const create = async () => {
    setCreating(true); setErr('');
    try {
      await api.createInvite(clientId, {
        clientEmail: email.trim() || null,
        label: label.trim() || null,
        days: Number(days) || 7,
      });
      setEmail(''); setLabel('');
      await load();
    } catch (e) {
      setErr(e.message || 'Could not create invite.');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (token) => {
    const url = 'https://record.cuecreative.com/record.html?token=' + encodeURIComponent(token);
    try { await navigator.clipboard.writeText(url); setCopied(token); setTimeout(() => setCopied(null), 1500); }
    catch { setErr('Could not copy to clipboard.'); }
  };

  const inputStyle = {
    background: 'var(--surface-2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    fontFamily: 'var(--f-mono)', fontSize: 13, padding: '9px 11px', height: 40,
    boxSizing: 'border-box',
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      {/* create */}
      <div className="card card-pad">
        <div className="label" style={{ marginBottom: 10 }}>NEW INVITE</div>
        <div className="col" style={{ gap: 8 }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Client email (optional)"
            style={{ ...inputStyle, width: '100%' }}
          />
          <div className="row" style={{ gap: 8, alignItems: 'stretch' }}>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (e.g. CEO avatar)"
              style={{ ...inputStyle, flex: 1 }}
            />
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
          </div>
        </div>
      </div>

      {err && <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>}

      {/* list */}
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
              <span className="badge">{inv.status || 'pending'}</span>
              <button className="btn sm" onClick={() => copyLink(inv.token)}>
                <Icon name="send" size={13} />
                {copied === inv.token ? 'Copied' : 'Copy link'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// —— Episodes (placeholder until Planner) ———————————————————————————
function EpisodesSection() {
  return (
    <div className="card card-pad" style={{ borderStyle: 'dashed' }}>
      <div className="label" style={{ marginBottom: 6 }}>EPISODES · COMING WITH PLANNER</div>
      <div className="mono" style={{ color: 'var(--text-3)' }}>
        Completed episodes with their publish dates will appear here once the Planner slice is built.
      </div>
    </div>
  );
}

function ClientDetailView({ client, onBack }) {
  const [tab, setTab] = useState('brief');
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

      {/* tab strip */}
      <div className="row" style={{ gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={'btn sm' + (tab === t.id ? ' primary' : '')}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* tab body — Brief and Recordings reuse their full components */}
      {tab === 'brief' && <BriefView clientId={client.id} />}
      {tab === 'recordings' && <RecordingsView activeClientId={client.id} />}
      {tab === 'scripts' && <ScriptsSection clientId={client.id} />}
      {tab === 'invites' && <InvitesSection clientId={client.id} />}
      {tab === 'episodes' && <EpisodesSection />}
    </div>
  );
}

export { ClientDetailView }
