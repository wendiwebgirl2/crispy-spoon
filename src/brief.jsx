import React, { useState, useEffect } from 'react'
import { api } from './api.js'
import { Icon } from './shared.jsx'

// Live Brief editor for the selected client. Contact fields (phone/address/
// mobile/website) are the source of truth the Scripts tab injects verbatim;
// the repository fields (positioning/audience/tone/notes) steer the copy.
const CONTACT = [
  ['phone', 'Phone', false],
  ['mobile', 'Mobile', false],
  ['website', 'Website', false],
  ['address', 'Address', true],
];
const REPO = [
  ['positioning', 'Positioning', true],
  ['audience', 'Audience', true],
  ['tone', 'Brand tone', false],
  ['notes', 'Notes', true],
];
const THEME = [
  ['theme_primary', 'Primary'],
  ['theme_secondary', 'Secondary'],
  ['theme_accent', 'Accent'],
];
const KEYS = [...CONTACT, ...REPO, ...THEME].map(([k]) => k);

const KIND_OPTS = ['podcast', 'social', 'website', 'other'];

function DistributionCard({ clientId }) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [form, setForm] = useState({ kind: 'podcast', platform: '', url: '', username: '', notes: '', secret: '' });
  const [revealed, setRevealed] = useState({});
  const [busy, setBusy] = useState(false);

  const load = () => api.listCredentials(clientId)
    .then((r) => setRows(Array.isArray(r) ? r : []))
    .catch((e) => setErr(e.message || 'Could not load channels.'));
  useEffect(() => { setRows([]); setErr(''); if (clientId) load(); }, [clientId]);

  const add = async () => {
    if (!form.platform.trim()) { setErr('Platform is required.'); return; }
    setBusy(true); setErr('');
    try {
      await api.addCredential(clientId, form);
      setForm({ kind: form.kind, platform: '', url: '', username: '', notes: '', secret: '' });
      await load();
    } catch (e) { setErr(e.message || 'Could not add channel.'); } finally { setBusy(false); }
  };
  const reveal = async (id) => {
    if (revealed[id]) { setRevealed((r) => ({ ...r, [id]: null })); return; }
    try { const d = await api.revealCredential(clientId, id); setRevealed((r) => ({ ...r, [id]: d.secret || '(empty)' })); }
    catch (e) { setErr(e.message || 'Could not reveal password.'); }
  };
  const remove = async (id) => {
    try { await api.deleteCredential(clientId, id); await load(); }
    catch (e) { setErr(e.message || 'Could not remove channel.'); }
  };

  const inp = { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', fontFamily: 'var(--f-mono)', fontSize: 13, padding: '8px 10px', boxSizing: 'border-box', width: '100%' };

  return (
    <div className="card card-pad" style={{ flex: '1 1 320px' }}>
      <div className="label" style={{ marginBottom: 12 }}>DISTRIBUTION · podcast / socials / websites</div>
      {err && <div className="mono" style={{ color: 'var(--accent)', marginBottom: 8 }}>{err}</div>}
      {rows.length === 0 && <div className="mono" style={{ color: 'var(--text-4)', marginBottom: 10 }}>No channels yet.</div>}
      {rows.map((c) => (
        <div key={c.id} className="row" style={{ justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{c.platform} <span className="mono" style={{ color: 'var(--text-4)', fontWeight: 400 }}>{c.kind}</span></div>
            {c.url && <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.url}</div>}
            {c.username && <div className="mono" style={{ color: 'var(--text-4)', fontSize: 12 }}>{c.username}</div>}
            {revealed[c.id] && <div className="mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>pw: {revealed[c.id]}</div>}
          </div>
          <div className="row" style={{ gap: 6 }}>
            {c.hasSecret && <button className="btn sm" onClick={() => reveal(c.id)}>{revealed[c.id] ? 'Hide' : 'Password'}</button>}
            <button className="btn sm" onClick={() => remove(c.id)}>Remove</button>
          </div>
        </div>
      ))}
      <div className="col" style={{ gap: 8, marginTop: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} style={{ ...inp, width: 130 }}>
            {KIND_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input placeholder="Platform (e.g. Spotify, Instagram)" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} style={inp} />
        </div>
        <input placeholder="URL" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} style={inp} />
        <input placeholder="Handle / username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} style={inp} />
        <input type="password" placeholder="Password (stored encrypted)" value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} style={inp} autoComplete="new-password" />
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={inp} />
        <button className="btn primary" onClick={add} disabled={busy}>{busy ? 'Adding…' : 'Add channel'}</button>
      </div>
    </div>
  );
}

function Field({ label, value, multiline, onChange }) {
  const base = {
    width: '100%', background: 'var(--surface-2)', color: 'var(--text)',
    border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    fontFamily: 'var(--f-mono)', fontSize: 13, padding: '10px 12px',
    boxSizing: 'border-box',
  };
  return (
    <div style={{ marginBottom: 14 }}>
      <div className="label" style={{ marginBottom: 6 }}>{label}</div>
      {multiline ? (
        <textarea
          className="textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          style={{ ...base, resize: 'vertical', minHeight: 64 }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...base, height: 42 }}
        />
      )}
    </div>
  );
}

function BriefView({ clientId }) {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (clientId == null) { setLoading(false); return; }
    setLoading(true); setErr(''); setSaved(false);
    api.getBrief(clientId)
      .then((b) => setForm(b || {}))
      .catch((e) => setErr(e.message || 'Could not load the brief.'))
      .finally(() => setLoading(false));
  }, [clientId]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  const save = async () => {
    if (clientId == null) return;
    setSaving(true); setErr('');
    try {
      const payload = Object.fromEntries(KEYS.map((k) => [k, form[k] ?? '']));
      await api.putBrief(clientId, payload);
      setSaved(true);
    } catch (e) {
      setErr(e.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  if (clientId == null) {
    return (
      <div className="v-pad">
        <div className="mono" style={{ color: 'var(--text-3)' }}>
          Select a client on the Clients tab first — then its brief loads here.
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="v-pad"><div className="mono" style={{ color: 'var(--text-3)' }}>Loading brief…</div></div>;
  }

  return (
    <div className="v-pad fade-in">
      <div className="label">BRIEF · LIVE</div>
      <h1 style={{ fontFamily: 'var(--f-display)', fontSize: 30, lineHeight: 1.1, margin: '6px 0 16px' }}>
        The client <em>brief</em>.
      </h1>

      {err && (
        <div className="card card-pad" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
          <div className="mono" style={{ color: 'var(--accent)' }}>{err}</div>
        </div>
      )}

      <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div className="card card-pad" style={{ flex: '1 1 320px' }}>
          <div className="label" style={{ marginBottom: 12 }}>CONTACT · injected verbatim into scripts</div>
          {CONTACT.map(([k, label, ml]) => (
            <Field key={k} label={label} multiline={ml} value={form[k] ?? ''} onChange={(v) => set(k, v)} />
          ))}
        </div>
        <div className="card card-pad" style={{ flex: '1 1 320px' }}>
          <div className="label" style={{ marginBottom: 12 }}>REPOSITORY · steers the copy</div>
          {REPO.map(([k, label, ml]) => (
            <Field key={k} label={label} multiline={ml} value={form[k] ?? ''} onChange={(v) => set(k, v)} />
          ))}
        </div>
        <DistributionCard clientId={clientId} />
        <div className="card card-pad" style={{ flex: '1 1 320px' }}>
          <div className="label" style={{ marginBottom: 12 }}>THEME · brand colors</div>
          {THEME.map(([k, label]) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <div className="label" style={{ marginBottom: 6 }}>{label}</div>
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(form[k] || '') ? form[k] : '#000000'} onChange={(e) => set(k, e.target.value)}
                  style={{ width: 44, height: 34, padding: 0, border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', cursor: 'pointer' }} />
                <input value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} placeholder="#RRGGBB"
                  style={{ flex: 1, height: 34, padding: '0 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 13 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="row" style={{ gap: 12, alignItems: 'center', marginTop: 18 }}>
        <button className="btn primary lg" onClick={save} disabled={saving}>
          <Icon name="check" size={15} stroke={2.2} />
          {saving ? 'Saving…' : 'Save brief'}
        </button>
        {saved && (
          <span className="mono" style={{ color: 'var(--ok)' }}>✓ saved</span>
        )}
      </div>
    </div>
  );
}

export { BriefView }
