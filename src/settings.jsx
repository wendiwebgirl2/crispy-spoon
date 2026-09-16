// components/settings.jsx — Workspace brand kit / API settings

import React from 'react'
import { Wordmark } from './shared.jsx'
import { api } from './api.js'

const inpStyle = { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', font: 'inherit', fontSize: 13, padding: '8px 10px' };
const selStyle = { ...inpStyle, cursor: 'pointer' };

// Real accounts + roles. Everyone sees who they're signed in as and can log out;
// admins additionally get user management (create/reset/disable, role, scoping).
function UsersSection() {
  const [me, setMe] = React.useState(null);
  const [users, setUsers] = React.useState(null);
  const [clients, setClients] = React.useState([]);
  const [err, setErr] = React.useState('');
  const [msg, setMsg] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [form, setForm] = React.useState({ username: '', password: '', role: 'editor', clientIds: [], email: '', sendEmail: true });
  // The plaintext password is only ever visible right after creation/resend —
  // it's scrypt-hashed server-side and never retrievable again after that.
  const [revealed, setRevealed] = React.useState(null); // { username, password, email }

  const loadUsers = () => api.listUsers().then((u) => setUsers(Array.isArray(u) ? u : [])).catch((e) => setErr(e.message));
  React.useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    api.listClients().then((r) => setClients(Array.isArray(r) ? r : (r.clients || []))).catch(() => setClients([]));
  }, []);
  React.useEffect(() => { if (me && me.role === 'admin') loadUsers(); }, [me]);

  const isAdmin = me && me.role === 'admin';
  const logout = async () => { try { await api.logout(); } catch { /* ignore */ } window.location.href = '/login.html'; };
  const changeMyPw = async () => {
    const current = window.prompt('Current password:', '');
    if (current == null) return;
    const next = window.prompt('New password (min 6 characters):', '');
    if (next == null) return;
    try { await api.changeMyPassword(current, next); setErr(''); setMsg('Your password was updated.'); }
    catch (e) { setErr(e.message); }
  };
  const create = async () => {
    setErr(''); setMsg(''); setRevealed(null); setBusy(true);
    try {
      const created = await api.createUser({
        username: form.username, password: form.password || undefined, role: form.role,
        clientIds: (form.role !== 'admin' && form.role !== 'manager') ? form.clientIds : [],
        email: form.email.trim() || undefined, sendEmail: !!(form.sendEmail && form.email.trim()),
      });
      setForm({ username: '', password: '', role: 'editor', clientIds: [], email: '', sendEmail: true });
      if (created.generatedPassword) {
        setRevealed({ username: created.username, password: created.generatedPassword, email: form.email.trim() || null });
      }
      setMsg(
        created.email
          ? (created.email.sent ? `User created and invite emailed to ${form.email.trim() || 'the client'}.` : `User created — email did NOT send (${created.email.error}). Copy the password below.`)
          : 'User created.'
      );
      loadUsers();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const resetPw = async (u) => {
    const pw = window.prompt(`New password for "${u.username}" (min 6 characters):`, '');
    if (pw == null) return;
    try { await api.resetUserPassword(u.id, pw); setErr(''); setMsg(`Password reset for ${u.username}.`); }
    catch (e) { setErr(e.message); }
  };
  // "Resend invite" — issues a fresh auto-generated password (invalidates the
  // old one) and optionally emails it, same credentials email as at creation.
  const resendInvite = async (u) => {
    const email = window.prompt(`Email the new login for "${u.username}" to:`, '');
    if (email == null) return;
    setErr(''); setMsg(''); setRevealed(null);
    try {
      const r = await api.regenerateUserPassword(u.id, email.trim() || undefined, !!email.trim());
      setRevealed({ username: u.username, password: r.generatedPassword, email: email.trim() || null });
      setMsg(
        r.email
          ? (r.email.sent ? `New password emailed to ${email.trim()}.` : `New password generated — email did NOT send (${r.email.error}). Copy it below.`)
          : 'New password generated. Copy it below.'
      );
    } catch (e) { setErr(e.message); }
  };
  const toggleActive = async (u) => { try { await api.updateUser(u.id, { active: !u.active }); loadUsers(); } catch (e) { setErr(e.message); } };
  const changeRole = async (u, role) => { try { await api.updateUser(u.id, { role }); loadUsers(); } catch (e) { setErr(e.message); } };
  const toggleFormClient = (id) => setForm((f) => ({ ...f, clientIds: f.clientIds.includes(id) ? f.clientIds.filter((x) => x !== id) : [...f.clientIds, id] }));

  return (
    <Section title="Users & access">
      {me
        ? <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <span className="mono" style={{ color: 'var(--text-3)' }}>Signed in as <strong style={{ color: 'var(--text)' }}>{me.username}</strong> · {me.role}</span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm" onClick={changeMyPw}>Change my password</button>
              <button className="btn sm" onClick={logout}>Log out</button>
            </div>
          </div>
        : <div className="mono" style={{ color: 'var(--text-4)' }}>Not signed in.</div>}

      {me && !isAdmin && <div className="mono" style={{ color: 'var(--text-4)' }}>Only admins can manage users.</div>}

      {isAdmin && <>
        {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 8 }}>{err}</div>}
        {msg && <div className="mono" style={{ color: 'var(--ok)', marginBottom: 8 }}>{msg}</div>}
        {revealed && (
          <div className="card" style={{ padding: 12, marginBottom: 12, border: '1px solid var(--ok)', background: 'var(--surface-2)' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 6 }}>
              One-time reveal — this password can't be shown again after you navigate away. Copy it now if the email didn't send.
            </div>
            <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'baseline' }}>
              <span className="mono" style={{ fontSize: 13 }}>Username: <strong>{revealed.username}</strong></span>
              <span className="mono" style={{ fontSize: 13 }}>Password: <strong>{revealed.password}</strong></span>
            </div>
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setRevealed(null)}>Dismiss</button>
          </div>
        )}
        <div className="col" style={{ gap: 2, marginBottom: 18 }}>
          {(users || []).map((u) => (
            <div key={u.id} className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, minWidth: 130 }}>{u.username}</span>
              <select value={u.role} onChange={(e) => changeRole(u, e.target.value)} disabled={me.id === u.id} style={selStyle}>
                <option value="admin">admin</option><option value="manager">manager</option><option value="editor">editor</option><option value="client">client</option>
              </select>
              {u.role !== 'admin' && u.role !== 'manager' && <span className="mono" style={{ fontSize: 11, color: 'var(--text-4)' }}>{u.clientIds.length} client{u.clientIds.length === 1 ? '' : 's'}</span>}
              <span className="mono" style={{ fontSize: 11, color: u.active ? 'var(--ok)' : 'var(--text-4)' }}>{u.active ? 'active' : 'disabled'}</span>
              <div className="row" style={{ gap: 6, marginLeft: 'auto' }}>
                <button className="btn sm" onClick={() => resendInvite(u)} title="Generate a new password and (optionally) email it">Resend invite</button>
                <button className="btn sm" onClick={() => resetPw(u)}>Reset password</button>
                <button className="btn sm" onClick={() => toggleActive(u)} disabled={me.id === u.id}>{u.active ? 'Disable' : 'Enable'}</button>
              </div>
            </div>
          ))}
          {users && users.length === 0 && <div className="mono" style={{ color: 'var(--text-4)' }}>No users yet.</div>}
        </div>

        <div className="label" style={{ marginBottom: 8 }}>ADD USER</div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input placeholder="Username" value={form.username} autoCapitalize="off" spellCheck={false} onChange={(e) => setForm({ ...form, username: e.target.value })} style={inpStyle} />
          <input placeholder="Password (blank = auto-generate)" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={inpStyle} />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={selStyle}>
            <option value="editor">editor</option><option value="manager">manager</option><option value="admin">admin</option><option value="client">client</option>
          </select>
          <button className="btn primary sm" onClick={create} disabled={busy || !form.username}>Create user</button>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          <input placeholder="Email — to send login link + credentials" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ ...inpStyle, minWidth: 260 }} />
          <label className="row" style={{ gap: 6, fontSize: 12, cursor: 'pointer', alignItems: 'center' }}>
            <input type="checkbox" checked={form.sendEmail} onChange={(e) => setForm({ ...form, sendEmail: e.target.checked })} /> Email the dashboard link + credentials
          </label>
        </div>
        {form.role !== 'admin' && form.role !== 'manager' && (
          <div style={{ marginTop: 10 }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-4)', marginBottom: 6 }}>{form.role === 'client' ? 'Client portal account — pick the ONE client it belongs to:' : 'Editor can access these clients (leave empty to assign later):'}</div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {clients.map((c) => (
                <label key={c.id} className="row" style={{ gap: 4, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '3px 8px' }}>
                  <input type="checkbox" checked={form.clientIds.includes(c.id)} onChange={() => toggleFormClient(c.id)} /> {c.name || ('Client ' + c.id)}
                </label>
              ))}
            </div>
          </div>
        )}
      </>}
    </Section>
  );
}

const SettingsView = () => {
  return (
    <div className="v-pad fade-in" style={{ maxWidth: 920, margin: '0 auto' }}>
      <div className="label" style={{ marginBottom: 10 }}>WORKSPACE</div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 38, letterSpacing: '-0.01em', margin: '0 0 36px' }}>
        Brand kit & <em style={{ color: 'var(--accent)' }}>integrations</em>.
      </h1>

      <UsersSection />

      <Section title="White-label">
        <Row k="Portal subdomain" v={<code className="mono" style={{ color: 'var(--text-2)' }}>portal.cuecreative.com</code>} />
        <Row k="Custom domain"    v={<span style={{ color: 'var(--text-3)' }}>Add a CNAME →</span>} />
        <Row k="Brand color"      v={<div className="row"><span style={{ width: 18, height: 18, background: 'var(--maroon)', borderRadius: 4 }} /> <code className="mono">#8B1F1F</code></div>} />
        <Row k="Wordmark"         v={<Wordmark size={18} />} />
      </Section>

      <Section title="HeyGen integration">
        <Row k="API key"          v={
          <div className="row" style={{ gap: 8 }}>
            <code className="mono" style={{ color: 'var(--text-2)' }}>sk_V2_hgu_••••••••••••••••••••••••••6X</code>
            <span className="badge ok" style={{ fontSize: 10 }}><span className="dot" />stored server-side</span>
          </div>
        } />
        <Row k="MCP endpoint"     v={<code className="mono">https://mcp.heygen.com/v1/sse</code>} />
        <Row k="Webhook"          v={<code className="mono">https://api.cuecreative.com/heygen/webhook</code>} />
        <Row k="Tools enabled"    v={<div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
          {['create_digital_twin', 'create_avatar_consent', 'generate_video', 'list_avatars'].map(t =>
            <span key={t} className="badge" style={{ fontSize: 10 }}>{t}</span>)}
        </div>} />
      </Section>

      <Section title="LLM">
        <Row k="Model"            v={<code className="mono">claude-haiku-4-5</code>} />
        <Row k="System prompt"    v={<span style={{ color: 'var(--text-3)' }}>Per-avatar (4 configured)</span>} />
        <Row k="Memory"           v={<span>Retrieval over uploaded knowledge sources</span>} />
      </Section>

      <Section title="Usage this cycle">
        <Row k="Avatars trained"  v={<span>2 / 10</span>} />
        <Row k="Render minutes"   v={<span>221 / 600</span>} />
        <Row k="Chat messages"    v={<span>1,847</span>} />
        <Row k="Cycle resets"     v={<span style={{ color: 'var(--text-3)' }}>June 12, 2026</span>} />
      </Section>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="card" style={{ marginBottom: 16, padding: 0 }}>
    <div className="label" style={{ padding: '16px 20px 12px' }}>{title}</div>
    <div className="hairline" />
    <div style={{ padding: '6px 20px 12px' }}>{children}</div>
  </div>
);

const Row = ({ k, v }) => (
  <div className="row" style={{
    padding: '14px 0', borderBottom: '1px solid var(--border)',
    justifyContent: 'space-between'
  }}>
    <span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>{k}</span>
    <span style={{ fontSize: 13 }}>{v}</span>
  </div>
);


export { SettingsView };