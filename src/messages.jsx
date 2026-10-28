import React from 'react'
import { api } from './api.js'
import { Icon, fmtStamp } from './shared.jsx'
import { refreshMessages, useUnreadMessages } from './unreadMessages.js'

// Private messages (staff -> any user). Stored server-side in
// user_notifications. Staff get a pop-up plus a flashing "Messages" row under
// Alerts until they actually open their messages — a message only counts as
// read once it has been shown on the Messages page / their account page.
// Clients (portal) keep the simple pop-up with "Got it". Only admins can delete.

const who = (username, fullName) => fullName || username || 'cue:cast team';

// Pop-up for unread messages. Mounted once in the dashboard shell and once in
// the portal shell; checks on load and every minute so a new message pops up
// while the person is signed in. With `onOpen` (dashboard) the buttons are
// "Later" (hide it for now — it stays unread and the sidebar keeps flashing)
// and "Open messages"; without it (portal) "Got it" marks it read.
export function MessagePopup({ onOpen }) {
  const rows = useUnreadMessages();
  const [later, setLater] = React.useState(() => new Set());
  const [busy, setBusy] = React.useState(false);
  const queue = rows.slice().reverse().filter((x) => !later.has(x.id));
  if (!queue.length) return null;
  const m = queue[0];
  const hide = (ids) => setLater((cur) => new Set([...cur, ...ids]));
  const gotIt = async () => {
    setBusy(true);
    try { await api.dismissNotification(m.id); } catch { /* best-effort — it shows again next check */ }
    hide([m.id]);
    setBusy(false);
    refreshMessages();
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,17,15,0.55)', zIndex: 1100, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="New message" className="card card-pad"
        style={{ width: 'min(480px, 100%)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
          <Icon name="send" size={14} />
          <span style={{ fontWeight: 600 }}>New message</span>
          {queue.length > 1 && <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-4)' }}>1 of {queue.length}</span>}
        </div>
        <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>From {who(m.from_username, m.from_full_name)} · {fmtStamp(m.created_at)}</div>
        <div style={{ fontSize: 14.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', maxHeight: '50vh', overflowY: 'auto' }}>{m.message}</div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          {onOpen ? (
            <>
              <button className="btn" onClick={() => hide([m.id])}>Later</button>
              <button className="btn primary" onClick={() => { hide(queue.map((x) => x.id)); onOpen(); }}>Open messages</button>
            </>
          ) : <button className="btn primary" disabled={busy} onClick={gotIt}>Got it</button>}
        </div>
      </div>
    </div>
  );
}

// Messages card on a staff account page. `messages` = { received, sent } from
// GET /api/accounts/:uid. On your own page you pick a recipient; on someone
// else's page the message goes to them.
export function MessagesCard({ user, messages, isSelf, canMessage, isAdmin, onChanged }) {
  const [tab, setTab] = React.useState('received');
  const [draft, setDraft] = React.useState('');
  const [to, setTo] = React.useState('');
  const [recipients, setRecipients] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState('');
  const [err, setErr] = React.useState('');
  React.useEffect(() => {
    if (!isSelf) return;
    api.messageRecipients().then((r) => setRecipients(Array.isArray(r) ? r : [])).catch(() => setRecipients([]));
  }, [isSelf]);

  // Opening your own messages is what marks them read (the sender's "read"
  // stamp), then the sidebar row stops flashing.
  React.useEffect(() => {
    if (!isSelf) return;
    const fresh = (messages.received || []).filter((m) => !m.read_at);
    if (!fresh.length) return;
    Promise.all(fresh.map((m) => api.dismissNotification(m.id).catch(() => {})))
      .then(() => { refreshMessages(); onChanged && onChanged(); });
  }, [isSelf, messages.received]); // eslint-disable-line react-hooks/exhaustive-deps

  const showComposer = isSelf || canMessage;
  const send = async () => {
    const body = draft.trim();
    const toId = isSelf ? Number(to) : user.id;
    if (!body || !toId) return;
    setBusy(true); setErr(''); setMsg('');
    try {
      const sent = await api.sendMessage(toId, body);
      setDraft('');
      setMsg(`Sent to ${who(sent.to_username, sent.to_full_name)}.`);
      if (isSelf) setTab('sent');
      onChanged && onChanged();
    } catch (e) { setErr(e.message || 'Could not send the message.'); }
    finally { setBusy(false); }
  };
  const remove = async (m) => {
    if (!window.confirm('Delete this message for everyone? This cannot be undone.')) return;
    try { await api.deleteMessage(m.id); onChanged && onChanged(); }
    catch (e) { setErr(e.message || 'Could not delete the message.'); }
  };

  const list = tab === 'sent' && messages.sent ? messages.sent : messages.received;
  const inp = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, padding: '7px 9px', width: '100%', font: 'inherit' };
  const tabBtn = (id, label) => (
    <button key={id} className={'btn sm' + (tab === id ? ' primary' : '')} onClick={() => setTab(id)}>{label}</button>
  );
  const groupLabel = (r) => (r.role === 'client' ? 'Client portal' : 'Team');

  return (
    <div className="card card-pad">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontWeight: 600 }}>Messages <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 400 }}>{isSelf ? '(private — between you and the sender)' : `(your messages to ${user.username}${isAdmin ? ' and everyone else’s' : ''})`}</span></span>
        {isSelf && <div className="row" style={{ gap: 6 }}>{tabBtn('received', `Received (${messages.received.length})`)}{tabBtn('sent', `Sent (${(messages.sent || []).length})`)}</div>}
      </div>

      {showComposer && (
        <div className="col" style={{ gap: 6, margin: '6px 0 10px' }}>
          {isSelf && (
            <select value={to} onChange={(e) => setTo(e.target.value)} style={inp}>
              <option value="">{recipients ? 'Send to…' : 'Loading people…'}</option>
              {['Team', 'Client portal'].map((g) => {
                const rows = (recipients || []).filter((r) => groupLabel(r) === g);
                return rows.length ? (
                  <optgroup key={g} label={g}>
                    {rows.map((r) => <option key={r.id} value={r.id}>{who(r.username, r.fullName)}{r.fullName ? ` (${r.username})` : ''}</option>)}
                  </optgroup>
                ) : null;
              })}
            </select>
          )}
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
            placeholder={isSelf ? 'Write a private message… (⌘+Enter to send)' : `Write a private message to ${user.username}… (⌘+Enter to send)`}
            style={{ ...inp, resize: 'vertical' }} />
          <div className="row" style={{ gap: 8, alignItems: 'center', justifyContent: 'flex-end' }}>
            {msg && <span className="mono" style={{ fontSize: 12, color: 'var(--ok)', marginRight: 'auto' }}>{msg}</span>}
            {err && <span className="mono" style={{ fontSize: 12, color: 'var(--accent)', marginRight: 'auto' }}>{err}</span>}
            <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>They’ll see it as a pop-up.</span>
            <button className="btn sm primary" disabled={busy || !draft.trim() || (isSelf && !to)} onClick={send}><Icon name="send" size={12} /> {busy ? 'Sending…' : 'Send'}</button>
          </div>
        </div>
      )}

      {!list.length && <div className="mono" style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>No messages yet.</div>}
      {list.map((m) => {
        const outgoing = tab === 'sent' || !isSelf;
        return (
          <div key={m.id} style={{ padding: '9px 0', borderTop: '1px solid var(--border)' }}>
            <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, fontSize: 12.5 }}>
                {tab === 'sent' ? 'To ' + who(m.to_username, m.to_full_name) : 'From ' + who(m.from_username, m.from_full_name)}
              </span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{fmtStamp(m.created_at)}</span>
              <span className="mono" style={{ fontSize: 11, color: m.read_at ? 'var(--ok)' : 'var(--text-4)' }}>
                {m.read_at ? (outgoing ? 'read ' : 'seen ') + fmtStamp(m.read_at) : 'unread'}
              </span>
              {isAdmin && <button className="btn sm" style={{ marginLeft: 'auto', padding: '2px 8px' }} onClick={() => remove(m)}>Delete</button>}
            </div>
            <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', marginTop: 3, color: 'var(--text-2)' }}>{m.message}</div>
          </div>
        );
      })}
    </div>
  );
}
