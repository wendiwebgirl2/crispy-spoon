import React from 'react'
import { api } from './api.js'
import { Icon, fmtStamp, ensureOperatorName } from './shared.jsx'
import { MessagesCard } from './messages.jsx'

// User account page — one person's details, private messages, the onboarding
// tasks assigned to them, and (admins/managers only) private staff notes about them. Admins and
// managers can open anyone's page from Settings -> Users; everyone else gets
// their own via "My account". Client accounts see their details in the portal.
const ROLE_LABEL = { admin: 'Admin', manager: 'Manager', editor: 'Editor', client: 'Client portal' };

export function UserAccountView({ userId, onBack, onOpenClient }) {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState({ fullName: '', email: '', phone: '' });
  const [busy, setBusy] = React.useState('');
  const [draft, setDraft] = React.useState('');
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [myId, setMyId] = React.useState(null);

  const load = React.useCallback(() => {
    if (!userId) return;
    api.userAccount(userId).then((d) => { setData(d); setErr(''); }).catch((e) => setErr(e.message || 'Could not load this account.'));
  }, [userId]);
  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => { api.me().then((m) => { setIsAdmin(!!m && m.role === 'admin'); setMyId(m ? m.id : null); }).catch(() => {}); }, []);

  if (err && !data) return <div className="v-pad fade-in"><div className="mono" style={{ color: 'var(--accent)' }}>{err}</div></div>;
  if (!data) return <div className="v-pad fade-in"><div className="mono">Loading…</div></div>;
  const { user, clients, tasks, notes, messages, canMessage, canEdit } = data;

  const startEdit = () => { setForm({ fullName: user.fullName || '', email: user.email || '', phone: user.phone || '' }); setEditing(true); };
  const saveDetails = async () => {
    setBusy('details'); setErr('');
    try { await api.updateUserAccount(user.id, form); setEditing(false); load(); }
    catch (e) { setErr(e.message || 'Could not save details.'); }
    finally { setBusy(''); }
  };
  const toggleTask = async (t) => {
    let payload = { done: false };
    if (!t.done) {
      const name = ensureOperatorName();
      if (!name) return;
      payload = { done: true, name };
    }
    setBusy('task-' + t.id); setErr('');
    try { await api.updateOnboardingTask(t.client_id, t.id, payload); load(); }
    catch (e) { setErr(e.message || 'Could not update that task.'); }
    finally { setBusy(''); }
  };
  const addNote = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy('note'); setErr('');
    try { await api.addUserNote(user.id, body); setDraft(''); load(); }
    catch (e) { setErr(e.message || 'Could not add the note.'); }
    finally { setBusy(''); }
  };
  const deleteNote = async (n) => {
    if (!window.confirm('Delete this note for everyone? This cannot be undone.')) return;
    try { await api.deleteUserNote(user.id, n.id); load(); }
    catch (e) { setErr(e.message || 'Could not delete the note.'); }
  };

  const display = user.fullName || user.username;
  const openTasks = tasks.filter((t) => !t.done && !t.na);
  const doneTasks = tasks.filter((t) => t.done || t.na);
  const inp = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontSize: 13, padding: '7px 9px', width: '100%' };
  const k = { fontFamily: 'var(--f-mono)', fontSize: 10, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--text-4)', minWidth: 90 };
  const row = (label, children) => (
    <div key={label} className="row" style={{ gap: 12, alignItems: 'baseline', padding: '7px 0', borderTop: '1px solid var(--border)' }}>
      <span style={k}>{label}</span><span style={{ fontSize: 13.5, flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
  const taskRow = (t) => (
    <div key={t.id} className="row" style={{ gap: 10, alignItems: 'center', padding: '7px 0', borderTop: '1px solid var(--border)' }}>
      <input type="checkbox" checked={t.done} disabled={t.na || busy === 'task-' + t.id} onChange={() => toggleTask(t)} title={t.done ? 'Mark not done' : 'Mark done'} />
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: t.done || t.na ? 'var(--text-3)' : 'var(--text)', textDecoration: t.done ? 'line-through' : 'none' }}>{t.label || t.task_key}</span>
      <button className="btn sm" onClick={() => onOpenClient && onOpenClient(t.client_id)} title="Open this client">{t.client_name}</button>
      {t.na && <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>N/A</span>}
      {t.done && <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{fmtStamp(t.completed_at)}</span>}
    </div>
  );

  return (
    <div className="fade-in" style={{ padding: 'var(--pad)', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {onBack && <div><button className="btn sm" onClick={onBack}><Icon name="arrow-l" size={12} /> Back</button></div>}

      <div className="card card-pad row" style={{ gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-display)', fontSize: 24, flex: 'none' }}>
          {display.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--f-display)', fontSize: 26, lineHeight: 1.1 }}>{display}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            {ROLE_LABEL[user.role] || user.role} · <span style={{ color: user.active ? 'var(--ok)' : 'var(--text-4)' }}>{user.active ? 'active' : 'disabled'}</span>
            {' · '}{user.last_login_at ? 'last signed in ' + fmtStamp(user.last_login_at) : 'never signed in'}
          </div>
        </div>
      </div>

      {err && <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>}

      <div className="card card-pad">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontWeight: 600 }}>Details</span>
          {canEdit && !editing && <button className="btn sm" onClick={startEdit}>Edit</button>}
        </div>
        {editing ? (
          <div className="col" style={{ gap: 8 }}>
            <label className="col" style={{ gap: 3 }}><span style={k}>Full name</span><input style={inp} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label>
            <label className="col" style={{ gap: 3 }}><span style={k}>Email</span><input style={inp} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="col" style={{ gap: 3 }}><span style={k}>Phone</span><input style={inp} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <div className="row" style={{ gap: 6, marginTop: 4 }}>
              <button className="btn sm primary" disabled={busy === 'details'} onClick={saveDetails}>{busy === 'details' ? 'Saving…' : 'Save'}</button>
              <button className="btn sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            {row('Full name', <>{user.fullName || <span style={{ color: 'var(--text-4)' }}>—</span>}</>)}
            {row('Email', <>{user.email ? <a href={'mailto:' + user.email} style={{ color: 'var(--accent-2)' }}>{user.email}</a> : <span style={{ color: 'var(--text-4)' }}>—</span>}</>)}
            {row('Phone', <>{user.phone || <span style={{ color: 'var(--text-4)' }}>—</span>}</>)}
            {row('Login', <>{user.username}</>)}
            {row('Role', <>{ROLE_LABEL[user.role] || user.role}</>)}
            {row('Clients', <>
              {user.role === 'admin' || user.role === 'manager'
                ? <span style={{ color: 'var(--text-3)' }}>All clients</span>
                : clients.length
                  ? <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>{clients.map((c) => <button key={c.id} className="btn sm" onClick={() => onOpenClient && onOpenClient(c.id)}>{c.name}</button>)}</span>
                  : <span style={{ color: 'var(--text-4)' }}>None assigned</span>}
            </>)}
            {row('Member since', <>{fmtStamp(user.created_at)}</>)}
          </>
        )}
      </div>

      {messages && <MessagesCard user={user} messages={messages} isSelf={myId === user.id} canMessage={canMessage} isAdmin={isAdmin} onChanged={load} />}

      {user.role !== 'client' && (
        <div className="card card-pad">
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Tasks <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 400 }}>{openTasks.length} open · {doneTasks.length} done</span></div>
          {!tasks.length && <div className="mono" style={{ fontSize: 12, color: 'var(--text-4)' }}>No onboarding tasks are assigned to {user.username}.</div>}
          {openTasks.map(taskRow)}
          {doneTasks.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary className="mono" style={{ fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}>Done ({doneTasks.length})</summary>
              {doneTasks.map(taskRow)}
            </details>
          )}
        </div>
      )}

      {notes && (
        <div className="card card-pad">
          <div style={{ fontWeight: 600 }}>Notes <span className="mono" style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 400 }}>(private — admins &amp; managers only; {user.username} never sees these)</span></div>
          {!notes.length && <div className="mono" style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 8 }}>No notes yet.</div>}
          {notes.map((n) => (
            <div key={n.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)', marginTop: 6 }}>
              <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600, fontSize: 12.5 }}>{n.author_username || '—'}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{fmtStamp(n.created_at)}</span>
                {isAdmin && <button className="btn sm" style={{ marginLeft: 'auto', padding: '2px 8px' }} onClick={() => deleteNote(n)}>Delete</button>}
              </div>
              <div style={{ fontSize: 13, whiteSpace: 'pre-wrap', marginTop: 3, color: 'var(--text-2)' }}>{n.body}</div>
            </div>
          ))}
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addNote(); }}
            placeholder={`Add a private note about ${user.username}… (⌘+Enter to post)`}
            style={{ ...inp, marginTop: 8, font: 'inherit', fontSize: 13, resize: 'vertical' }} />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
            <button className="btn sm primary" disabled={busy === 'note' || !draft.trim()} onClick={addNote}><Icon name="check" size={12} /> {busy === 'note' ? 'Posting…' : 'Add note'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
