// invitations.jsx — global invitations view, wired to the live VoiceCast API.
// Lists every invite across clients (GET /api/invites) and creates real invites
// (POST /api/clients/:id/invites) against a chosen client. The ornate demo
// compose/preview was replaced with a real, focused flow.

import React, { useState, useEffect } from 'react'
import { Icon } from './shared.jsx'
import { api } from './api.js'

function fmtDate(s) {
  if (!s) return '—';
  return String(s).slice(0, 10);
}

const STATUS_TONE = {
  pending:   { fg: 'var(--text-2)' },
  recorded:  { fg: 'var(--ok)' },
  expired:   { fg: 'var(--accent)' },
  disabled:  { fg: 'var(--text-4)' },
};

const InvitationsView = () => {
  const [mode, setMode] = useState('list'); // 'list' | 'compose'
  if (mode === 'compose') return <ComposeView onClose={() => setMode('list')} />;
  return <InvitationsList onCompose={() => setMode('compose')} />;
};

// —— List ————————————————————————————————————————————————————————————
const InvitationsList = ({ onCompose }) => {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(null);

  const load = () => {
    setLoading(true); setErr('');
    return api.listAllInvites()
      .then((r) => setInvites(Array.isArray(r) ? r : (r.invites || [])))
      .catch((e) => setErr(e.message || 'Could not load invitations.'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const copyLink = async (token) => {
    const url = 'https://record.cuecreative.com/record.html?token=' + encodeURIComponent(token);
    try { await navigator.clipboard.writeText(url); setCopied(token); setTimeout(() => setCopied(null), 1500); }
    catch { setErr('Could not copy to clipboard.'); }
  };

  const counts = {
    all: invites.length,
    pending: invites.filter((i) => i.status === 'pending').length,
    recorded: invites.filter((i) => i.status === 'recorded').length,
    expired: invites.filter((i) => i.status === 'expired').length,
    disabled: invites.filter((i) => i.status === 'disabled').length,
  };
  const filtered = filter === 'all' ? invites : invites.filter((i) => i.status === filter);

  return (
    <div className="v-pad fade-in">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>INVITATIONS · LIVE</div>
          <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 34, lineHeight: 1.1, margin: '0 0 4px' }}>
            Every <em>invitation</em>, across clients.
          </h1>
          <div className="mono" style={{ color: 'var(--text-3)' }}>Record links you've created — newest first.</div>
        </div>
        <button className="btn primary" onClick={onCompose}>
          <Icon name="send" size={14} stroke={2.2} /> New invitation
        </button>
      </div>

      {err && (
        <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>
        </div>
      )}

      {/* filter chips */}
      <div className="row" style={{ gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['all', 'All'], ['pending', 'Pending'], ['recorded', 'Recorded'], ['expired', 'Expired'], ['disabled', 'Disabled']].map(([k, label]) => (
          <button key={k} className={'btn sm' + (filter === k ? ' primary' : '')} onClick={() => setFilter(k)}>
            {label} <span className="mono" style={{ opacity: 0.7 }}>{counts[k]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>Loading invitations…</div>
      ) : filtered.length === 0 ? (
        <div className="mono" style={{ color: 'var(--text-3)' }}>
          {invites.length === 0 ? 'No invitations yet — create your first.' : `No invitations match "${filter}".`}
        </div>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {filtered.map((inv) => (
            <div key={inv.id} className="card card-pad row" style={{ gap: 12, alignItems: 'center' }}>
              <Icon name="send" size={16} style={{ color: 'var(--text-3)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>
                  {inv.client_name}
                  {inv.label ? <span style={{ color: 'var(--text-3)', fontWeight: 400 }}> · {inv.label}</span> : null}
                </div>
                <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inv.client_email || 'no email'} · created {fmtDate(inv.created_at)} · expires {fmtDate(inv.expires_at)}
                </div>
              </div>
              <span className="badge" style={{ color: (STATUS_TONE[inv.status] || {}).fg || 'var(--text-2)' }}>
                {inv.status || 'pending'}
              </span>
              <button className="btn sm" onClick={() => copyLink(inv.token)}>
                <Icon name="send" size={13} /> {copied === inv.token ? 'Copied' : 'Copy link'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// —— Compose (real) ——————————————————————————————————————————————————
const ComposeView = ({ onClose }) => {
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [created, setCreated] = useState(null); // { token }

  useEffect(() => {
    api.listClients()
      .then((cs) => setClients(Array.isArray(cs) ? cs : (cs.clients || [])))
      .catch((e) => setErr(e.message || 'Could not load clients.'));
  }, []);

  const inputStyle = {
    background: 'var(--surface-2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    fontFamily: 'var(--f-mono)', fontSize: 13, padding: '10px 12px', height: 42,
    boxSizing: 'border-box', width: '100%',
  };

  const create = async () => {
    if (!clientId) { setErr('Pick a client first.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await api.createInvite(clientId, {
        clientEmail: email.trim() || null,
        label: label.trim() || null,
        days: Number(days) || 7,
      });
      setCreated({ token: res?.token });
    } catch (e) {
      setErr(e.message || 'Could not create invitation.');
    } finally {
      setBusy(false);
    }
  };

  const recordUrl = created?.token
    ? 'https://record.cuecreative.com/record.html?token=' + encodeURIComponent(created.token)
    : '';

  if (created) {
    return (
      <div className="v-pad fade-in">
        <button className="btn sm" onClick={onClose} style={{ marginBottom: 16 }}>← Back to invitations</button>
        <div className="card card-pad" style={{ maxWidth: 560 }}>
          <div className="label" style={{ color: 'var(--ok)', marginBottom: 8 }}>INVITE CREATED</div>
          <div className="mono" style={{ color: 'var(--text-3)', marginBottom: 12 }}>
            Share this record link with the client. (Email auto-send is a separate step.)
          </div>
          <div className="mono" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: 12, fontSize: 12, wordBreak: 'break-all', marginBottom: 12 }}>
            {recordUrl}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn primary" onClick={() => navigator.clipboard.writeText(recordUrl)}>
              <Icon name="send" size={13} /> Copy link
            </button>
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="v-pad fade-in">
      <button className="btn sm" onClick={onClose} style={{ marginBottom: 16 }}>← Back to invitations</button>
      <div className="label" style={{ marginBottom: 6 }}>NEW INVITATION</div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, lineHeight: 1.1, margin: '0 0 16px' }}>
        Send a <em>record-your-avatar</em> link.
      </h1>

      {err && (
        <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>
        </div>
      )}

      <div className="card card-pad" style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>CLIENT</div>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={{ ...inputStyle }}>
            <option value="">Select a client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>CLIENT EMAIL (optional)</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@company.com" style={inputStyle} />
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="label" style={{ marginBottom: 6 }}>LABEL (optional)</div>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. CEO avatar" style={inputStyle} />
          </div>
          <div style={{ width: 120 }}>
            <div className="label" style={{ marginBottom: 6 }}>EXPIRES</div>
            <select value={days} onChange={(e) => setDays(e.target.value)} style={inputStyle}>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
            </select>
          </div>
        </div>
        <button className="btn primary lg" onClick={create} disabled={busy || !clientId} style={{ justifyContent: 'center', marginTop: 4 }}>
          <Icon name="send" size={14} /> {busy ? 'Creating…' : 'Create invitation'}
        </button>
        <div className="mono" style={{ color: 'var(--text-4)', fontSize: 11, textAlign: 'center' }}>
          Creates a real record link tied to the selected client.
        </div>
      </div>
    </div>
  );
};

export { InvitationsView }
